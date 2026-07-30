import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import InvoiceCounter from '../models/InvoiceCounter.js';
import { AppError } from '../utils/AppError.js';
import * as storageService from './storage/storageService.js';
import { sendInvoiceEmail } from './email.service.js';
const PDF_MAGIC_BYTES = '%PDF-';

function assertValidId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid invoice id', 400);
  }
}

function paginationMeta({ total, page, limit }) {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** status/currency are exact-match filters (chosen from a dropdown in
    the UI); `q` is a free-text substring match across invoice number
    and customer/company — same shape as salaryHistory.service.js's
    buildQuery. dateFrom/dateTo filter on invoiceDate (stored as a
    plain 'YYYY-MM-DD' string, same as the frontend's date input value,
    so a lexicographic $gte/$lte range comparison is correct). */
function buildQuery({ status, currency, q, dateFrom, dateTo }) {
  const query = {};
  if (status) query.status = status;
  if (currency) query.currency = currency;
  if (dateFrom || dateTo) {
    query.invoiceDate = {};
    if (dateFrom) query.invoiceDate.$gte = dateFrom;
    if (dateTo) query.invoiceDate.$lte = dateTo;
  }
  const term = (q || '').trim();
  if (term) {
    query.$or = [
      { invoiceNumber: { $regex: term, $options: 'i' } },
      { customer: { $regex: term, $options: 'i' } },
      { company: { $regex: term, $options: 'i' } },
    ];
  }
  return query;
}

function sortSpecFor(sort) {
  switch (sort) {
    case 'oldest': return { createdAt: 1 };
    case 'amount_desc': return { grandTotal: -1 };
    case 'amount_asc': return { grandTotal: 1 };
    case 'dueDate': return { dueDate: 1 };
    default: return { createdAt: -1 };
  }
}

const DEFAULT_PREFIX = 'INV';
/** 2-6 uppercase letters — mirrors the frontend's own
    sanitizeInvoicePrefix (modules/finance/utils/invoiceSettingsStore.ts)
    so a malformed prefix can never reach nextInvoiceNumber, regardless
    of which caller sends it. */
const PREFIX_RE = /^[A-Z]{2,6}$/;

function sanitizePrefix(prefix) {
  const cleaned = String(prefix || '').trim().toUpperCase();
  return PREFIX_RE.test(cleaned) ? cleaned : DEFAULT_PREFIX;
}

/** Atomically assigns the next sequential invoice number for the given
    year, e.g. INV-2026-0001. Uses a dedicated per-year counter
    document incremented via $inc (findByIdAndUpdate + upsert), which
    MongoDB guarantees is race-safe under concurrent requests — unlike
    scanning for the current max invoiceNumber and adding 1, which can
    produce duplicates. No prior counter-collection pattern exists in
    this backend; this is introduced fresh for Invoice numbering.
    Sprint 7 — prefix is configurable (Invoice Settings), but the
    counter key for the default "INV" prefix stays a bare year string
    (e.g. "2026"), exactly as it always has, so nobody who never
    touches the new setting sees any change in behavior; a non-default
    prefix gets its own "${prefix}-${year}" counter so switching
    prefixes can never collide with or renumber invoices already
    issued under a different one. */
async function nextInvoiceNumber(date = new Date(), prefix = DEFAULT_PREFIX) {
  const year = date.getFullYear();
  const safePrefix = sanitizePrefix(prefix);
  const counterKey = safePrefix === DEFAULT_PREFIX ? String(year) : `${safePrefix}-${year}`;
  const counter = await InvoiceCounter.findByIdAndUpdate(
    counterKey,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${safePrefix}-${year}-${String(counter.seq).padStart(4, '0')}`;
}

export async function getAllInvoices({ page = 1, limit = 50, status, currency, q, dateFrom, dateTo, sort = 'newest' } = {}) {
  const skip = (page - 1) * limit;
  const query = buildQuery({ status, currency, q, dateFrom, dateTo });
  const sortSpec = sortSpecFor(sort);
  const [items, total] = await Promise.all([
    Invoice.find(query).sort(sortSpec).skip(skip).limit(limit),
    Invoice.countDocuments(query),
  ]);
  return { items, ...paginationMeta({ total, page, limit }) };
}

export async function getInvoiceById(id) {
  assertValidId(id);
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
}

/** invoiceNumber is always server-assigned here, never accepted from
    the client — Part 3's "automatically assigned... read-only in UI"
    requirement. Any invoiceNumber present on the incoming payload
    (e.g. a stale value from a Duplicate flow) is ignored.
    `invoiceNumberPrefix` (Sprint 7, optional) is the one exception:
    the client's configured Invoice Settings prefix is honored for
    numbering, but never stored as its own field on the document — the
    assigned invoiceNumber already encodes it. */
export async function createInvoice(data) {
  const { invoiceNumber, invoiceNumberPrefix, ...rest } = data || {};
  void invoiceNumber;
  try {
    const assignedNumber = await nextInvoiceNumber(new Date(), invoiceNumberPrefix);
    return await Invoice.create({ ...rest, invoiceNumber: assignedNumber });
  } catch (err) {
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    if (err.code === 11000) throw new AppError('Duplicate invoice number, please retry', 409);
    throw err;
  }
}

/** invoiceNumber is assigned once at creation and is read-only
    thereafter — stripped from the update payload so an Edit save can
    never change it. */
export async function updateInvoice(id, data) {
  assertValidId(id);
  const { invoiceNumber, invoiceNumberPrefix, ...rest } = data || {};
  void invoiceNumber;
  void invoiceNumberPrefix;
  try {
    const invoice = await Invoice.findByIdAndUpdate(id, rest, {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'ValidationError') throw new AppError(err.message, 400);
    throw err;
  }
}

export async function deleteInvoice(id) {
  assertValidId(id);
  const invoice = await Invoice.findByIdAndDelete(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
}

function assertPdfBuffer(buffer) {
  if (!buffer || buffer.length === 0) throw new AppError('PDF file is empty', 400);
  if (buffer.subarray(0, 5).toString('ascii') !== PDF_MAGIC_BYTES) {
    throw new AppError('Uploaded file is not a valid PDF', 400);
  }
}

/** Part 5 workflow — "Generate PDF → Upload PDF → Save Google Drive
    File ID → Update MongoDB". Uploads to the dedicated "Invoices"
    Drive folder tree (see storage/googleDriveProvider.js's
    uploadInvoiceFile, a completely separate tree from the salary-slip
    archive), then writes the result directly onto this Invoice
    document — no separate PdfArchive-style collection, per "keep the
    Invoice PDF completely independent". */
export async function attachInvoicePdf(id, buffer) {
  assertValidId(id);
  assertPdfBuffer(buffer);
  const invoice = await getInvoiceById(id);
  const year = (invoice.invoiceDate || '').slice(0, 4) || String(new Date().getFullYear());
  const fileName = `${invoice.invoiceNumber}.pdf`;

  const { fileId, shareUrl } = await storageService.uploadInvoice({ buffer, fileName, year });

  const updated = await Invoice.findByIdAndUpdate(
    id,
    { driveFileId: fileId, driveFileUrl: shareUrl, pdfGeneratedAt: new Date() },
    { new: true }
  );
  return updated;
}

/** Sends the invoice PDF via sendInvoiceEmail (email.service.js,
    reusing the existing Resend client) and records the outcome
    directly on the Invoice document — mirrors SalaryHistory's flat
    emailStatus/emailSentAt/emailRecipient fields rather than a
    separate EmailLog-style audit collection. A failed send still
    records emailStatus: 'Failed' before the error propagates, same as
    email.service.js's sendSalaryEmail does for SalaryHistory. */
export async function emailInvoicePdf(id, { recipientEmail, subject, companyName, buffer }) {
  assertValidId(id);
  assertPdfBuffer(buffer);
  if (!recipientEmail) throw new AppError('Recipient email is required', 400, 'validation');
  const invoice = await getInvoiceById(id);

  try {
    await sendInvoiceEmail({
      recipientEmail,
      subject,
      companyName,
      buffer,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer,
    });
  } catch (err) {
    await Invoice.findByIdAndUpdate(id, { emailStatus: 'Failed', emailRecipient: recipientEmail }).catch(() => {});
    throw err;
  }

  const updated = await Invoice.findByIdAndUpdate(
    id,
    { emailStatus: 'Sent', emailSentAt: new Date(), emailRecipient: recipientEmail },
    { new: true }
  );
  return updated;
}
