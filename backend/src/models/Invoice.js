import mongoose from 'mongoose';

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

/** Embedded, not a separate collection — a line item only ever exists
    as part of one invoice, same reasoning as SalaryHistory's
    salaryItemSchema. The frontend's ephemeral React list-key (`id`)
    is intentionally not persisted; the frontend regenerates local
    keys whenever it loads a fetched invoice's items array. */
const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * Invoice schema (Sprint 4) — a completely independent Finance-module
 * collection, unrelated to Employee/SalaryHistory. Field names follow
 * the sprint spec's suggested list literally: `customer`/`company` are
 * flat name fields (mirroring the frontend's CustomerDetails.customerName/
 * companyName); see src/modules/finance/services/invoiceApi.ts for the
 * mapping between this flat wire shape and the frontend's nested
 * CustomerDetails object. `invoiceNumber` is assigned server-side once,
 * on create, via services/invoice.service.js's nextInvoiceNumber() —
 * never accepted from the client and never changed on update.
 */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    customer: { type: String, required: [true, 'Customer name is required'], trim: true },
    company: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, default: '' },
    billingAddress: { type: String, trim: true, default: '' },
    invoiceDate: { type: String, trim: true, default: '' },
    dueDate: { type: String, trim: true, default: '' },
    paymentTerms: { type: String, enum: [...PAYMENT_TERMS, null], default: 'Due on Receipt' },
    currency: { type: String, trim: true, default: 'INR' },
    status: { type: String, enum: INVOICE_STATUSES, default: 'Draft' },
    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
