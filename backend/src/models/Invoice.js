import mongoose from 'mongoose';

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'];

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
    /** Sprint 7 — snapshotted from Invoice Settings' default at create
        time (frontend, see modules/finance/utils/invoiceSettingsStore.ts),
        editable per-invoice thereafter, same as notes. Optional/additive
        so pre-Sprint-7 invoices simply read as ''; the footer falls back
        to the live Invoice Settings default when this is empty. */
    termsAndConditions: { type: String, trim: true, default: '' },
    /** Sprint 5 — Google Drive archive of this invoice's generated PDF.
        Set by services/invoice.service.js's attachInvoicePdf(), which
        uploads to a dedicated "Invoices" Drive folder tree (see
        services/storage/googleDriveProvider.js) — entirely separate
        from the salary-slip archive tree/collection (PdfArchive is not
        reused here, per "keep the Invoice PDF completely independent"). */
    driveFileId: { type: String, default: null },
    driveFileUrl: { type: String, default: null },
    pdfGeneratedAt: { type: Date, default: null },
    /** Sprint 5 — current email-send state for this invoice, same flat-
        field shape SalaryHistory already uses (emailStatus/emailSentAt/
        emailRecipient) rather than a separate audit-log collection. */
    emailStatus: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: null },
    emailSentAt: { type: Date, default: null },
    emailRecipient: { type: String, trim: true, default: null },

    /** Sprint 9 (Gemini integration + demo data) — see Employee.js's
        identical field for the full rationale. Set to 'ARNA_DEMO' only
        by scripts/seedDemoData.js; every real invoice omits it. */
    source: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
