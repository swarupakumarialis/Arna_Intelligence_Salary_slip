import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import InvoiceCounter from '../models/InvoiceCounter.js';
import { AppError } from '../utils/AppError.js';

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

/** Atomically assigns the next sequential invoice number for the given
    year, e.g. INV-2026-0001. Uses a dedicated per-year counter
    document incremented via $inc (findByIdAndUpdate + upsert), which
    MongoDB guarantees is race-safe under concurrent requests — unlike
    scanning for the current max invoiceNumber and adding 1, which can
    produce duplicates. No prior counter-collection pattern exists in
    this backend; this is introduced fresh for Invoice numbering. */
async function nextInvoiceNumber(date = new Date()) {
  const year = date.getFullYear();
  const counter = await InvoiceCounter.findByIdAndUpdate(
    String(year),
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INV-${year}-${String(counter.seq).padStart(4, '0')}`;
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
    (e.g. a stale value from a Duplicate flow) is ignored. */
export async function createInvoice(data) {
  const { invoiceNumber, ...rest } = data || {};
  void invoiceNumber;
  try {
    const assignedNumber = await nextInvoiceNumber();
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
  const { invoiceNumber, ...rest } = data || {};
  void invoiceNumber;
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
