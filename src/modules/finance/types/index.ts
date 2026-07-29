import type { CurrencyCode } from '../../../utils/currencyService';

/**
 * Finance module — Invoice domain types (Sprint 3). The one canonical
 * definition of "what an invoice's editable state looks like" —
 * InvoiceGeneratorPage (the form) and every component under
 * invoice-generator/components/ (the live preview) import these
 * rather than each declaring their own shape, so the preview can
 * never structurally drift from the form it's mirroring.
 */

export const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface CustomerDetails {
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  gstin: string;
  billingAddress: string;
}

export interface InvoiceDetails {
  invoiceDate: string;
  dueDate: string;
  paymentTerms: PaymentTerm;
  currency: CurrencyCode;
  status: InvoiceStatus;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

/** Output of utils/computeInvoiceTotals — computed once by
    InvoiceGeneratorPage and passed down as a prop, never
    recalculated independently by the preview (see that page's
    `totals` useMemo). */
export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * A fully persisted invoice (Sprint 4) — CustomerDetails + InvoiceDetails
 * fields plus what only exists once a record has been saved to MongoDB.
 * Deliberately omits totals: InvoiceGeneratorPage always recomputes them
 * from `items`/`discount` via computeInvoiceTotals, the same single
 * source of truth the live preview already relies on — so this type
 * never risks disagreeing with a stored total. The wire-format
 * translation (this app's nested CustomerDetails vs. the backend's flat
 * customer/company/... fields) lives entirely in
 * services/invoiceApi.ts's fromApiRecord/toApiPayload, the same
 * convention salaryHistoryApi.ts/employeeApi.ts already use.
 */
export interface Invoice extends CustomerDetails, InvoiceDetails {
  id: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  discount: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}
