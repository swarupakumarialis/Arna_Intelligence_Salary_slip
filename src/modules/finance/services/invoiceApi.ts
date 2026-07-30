import type { CurrencyCode } from '../../../utils/currencyService';
import { Invoice, InvoiceItem, InvoiceStatus, PaymentTerm } from '../types';
import { makeItemId } from '../utils';

/**
 * Centralised Invoice API client (Sprint 4) — mirrors
 * src/api/salaryHistoryApi.ts's design exactly (same request() helper,
 * same ApiError, same {success,message,data} envelope handling).
 * Every network call the Finance module makes for invoice data goes
 * through this file. Kept under modules/finance/services/ rather than
 * the app-wide src/api/ so the Invoice module stays a self-contained,
 * independent slice, per this module's Sprint 1 folder convention.
 *
 * Unlike salaryHistoryApi.ts, the wire shape here does NOT match the
 * frontend's field names 1:1 — the backend stores flat `customer`/
 * `company` strings (backend/src/models/Invoice.js) while the frontend
 * groups them under a nested CustomerDetails shape. fromApiRecord/
 * toApiPayload below are the one place that translation happens.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

interface InvoiceItemApiRecord {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

interface InvoiceApiRecord {
  _id: string;
  invoiceNumber: string;
  customer: string;
  company: string;
  email: string;
  phone: string;
  gstin: string;
  billingAddress: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: PaymentTerm;
  currency: CurrencyCode;
  status: InvoiceStatus;
  items: InvoiceItemApiRecord[];
  discount: number;
  notes: string;
  termsAndConditions: string;
  createdAt?: string;
  updatedAt?: string;
  driveFileId?: string | null;
  driveFileUrl?: string | null;
  pdfGeneratedAt?: string | null;
  emailStatus?: 'Pending' | 'Sent' | 'Failed' | null;
  emailSentAt?: string | null;
  emailRecipient?: string | null;
}

export interface PaginatedInvoices {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  currency?: CurrencyCode;
  q?: string;
  /** Filters on invoiceDate, inclusive — both plain 'YYYY-MM-DD' strings. */
  dateFrom?: string;
  dateTo?: string;
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'dueDate';
}

/** Thrown by every function in this file on any failure — same
    contract as salaryHistoryApi.ts's ApiError. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function fromApiRecord(record: InvoiceApiRecord): Invoice {
  return {
    id: record._id,
    invoiceNumber: record.invoiceNumber,
    customerName: record.customer,
    companyName: record.company,
    email: record.email,
    phone: record.phone,
    gstin: record.gstin,
    billingAddress: record.billingAddress,
    invoiceDate: record.invoiceDate,
    dueDate: record.dueDate,
    paymentTerms: record.paymentTerms,
    currency: record.currency,
    status: record.status,
    items: (record.items || []).map((item): InvoiceItem => ({ id: makeItemId(), ...item })),
    discount: record.discount,
    notes: record.notes,
    termsAndConditions: record.termsAndConditions ?? '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    driveFileId: record.driveFileId,
    driveFileUrl: record.driveFileUrl,
    pdfGeneratedAt: record.pdfGeneratedAt,
    emailStatus: record.emailStatus,
    emailSentAt: record.emailSentAt,
    emailRecipient: record.emailRecipient,
  };
}

/** Strips the frontend-only `id`/`invoiceNumber`/timestamps (the
    backend assigns/owns invoiceNumber — see invoice.service.js's
    createInvoice/updateInvoice, which ignore any invoiceNumber sent
    in the payload) and each item's ephemeral list-key id. */
function toApiPayload(invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
  return {
    customer: invoice.customerName,
    company: invoice.companyName,
    email: invoice.email,
    phone: invoice.phone,
    gstin: invoice.gstin,
    billingAddress: invoice.billingAddress,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    paymentTerms: invoice.paymentTerms,
    currency: invoice.currency,
    status: invoice.status,
    items: invoice.items.map(({ description, quantity, unitPrice, taxPercent }) => ({
      description, quantity, unitPrice, taxPercent,
    })),
    discount: invoice.discount,
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Unable to connect to server');
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* Non-JSON response — fall through, handled by the !res.ok check below. */
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

type InvoiceListResponse = { items: InvoiceApiRecord[]; total: number; page: number; limit: number; totalPages: number };

export async function getInvoices(params: InvoiceQueryParams = {}): Promise<PaginatedInvoices> {
  const data = await request<InvoiceListResponse>(
    `/invoices${buildQuery({
      page: params.page,
      limit: params.limit,
      status: params.status,
      currency: params.currency,
      q: params.q,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sort: params.sort,
    })}`
  );
  return { ...data, items: data.items.map(fromApiRecord) };
}

export async function getInvoice(id: string): Promise<Invoice> {
  const record = await request<InvoiceApiRecord>(`/invoices/${id}`);
  return fromApiRecord(record);
}

/** `invoiceNumberPrefix` (Sprint 7, optional) — the Invoice Settings-
    configured prefix (see modules/finance/utils/invoiceSettingsStore.ts),
    honored only on create; the backend ignores it entirely on update
    since invoiceNumber is assigned once and read-only thereafter. Not
    part of the Invoice type itself — it's a numbering instruction, not
    a field the invoice document stores on its own. */
export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>,
  invoiceNumberPrefix?: string
): Promise<Invoice> {
  const saved = await request<InvoiceApiRecord>('/invoices', {
    method: 'POST',
    body: JSON.stringify({ ...toApiPayload(invoice), invoiceNumberPrefix }),
  });
  return fromApiRecord(saved);
}

export async function updateInvoice(
  id: string,
  invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>
): Promise<Invoice> {
  const saved = await request<InvoiceApiRecord>(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toApiPayload(invoice)),
  });
  return fromApiRecord(saved);
}

export async function deleteInvoice(id: string): Promise<void> {
  await request<null>(`/invoices/${id}`, { method: 'DELETE' });
}

/** Sprint 5, Part 5 — uploads the exact PDF Blob the caller already
    generated (see pdf/generateInvoicePdf.ts) to the backend's Invoices
    Drive folder, and returns the invoice with driveFileId/driveFileUrl
    populated. Deliberately a standalone fetch, not the shared
    request() helper — a file upload is FormData, not JSON, same
    reasoning as src/api/pdfApi.ts's uploadPdf(). */
export async function uploadInvoicePdf(id: string, blob: Blob, fileName: string): Promise<Invoice> {
  const formData = new FormData();
  formData.append('pdf', blob, fileName);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/invoices/${id}/pdf`, { method: 'POST', body: formData });
  } catch {
    throw new ApiError('Unable to connect to server');
  }
  const record = await parseEnvelope<InvoiceApiRecord>(res);
  return fromApiRecord(record);
}

export interface EmailInvoiceParams {
  recipientEmail: string;
  subject?: string;
  companyName?: string;
  pdfBlob: Blob;
}

/** Sprint 5, Part 6 — mirrors src/api/emailApi.ts's sendSalaryEmail:
    sends the exact same in-memory PDF Blob already generated/uploaded,
    as a multipart attachment, never a re-derived copy. */
export async function emailInvoice(id: string, params: EmailInvoiceParams): Promise<Invoice> {
  const formData = new FormData();
  formData.append('pdf', params.pdfBlob, 'invoice.pdf');
  formData.append('recipientEmail', params.recipientEmail);
  if (params.subject) formData.append('subject', params.subject);
  if (params.companyName) formData.append('companyName', params.companyName);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/invoices/${id}/email`, { method: 'POST', body: formData });
  } catch {
    throw new ApiError('Unable to connect to server');
  }

  let body: ApiEnvelope<InvoiceApiRecord> & { stage?: string | null } | null = null;
  try {
    body = await res.json();
  } catch {
    /* Non-JSON response — fall through, handled by the !res.ok check below. */
  }
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return fromApiRecord(body.data);
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* Non-JSON response — fall through, handled by the !res.ok check below. */
  }
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}
