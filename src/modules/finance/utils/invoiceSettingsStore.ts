import type { CurrencyCode } from '../../../utils/currencyService';

/**
 * Invoice Settings (Sprint 7) — configuration specific to the Invoice
 * module: numbering prefix, defaults for new invoices, and the
 * Payment Information block (bank/UPI/QR/signature) shown on every
 * invoice's footer. Deliberately a separate localStorage store from
 * companySettingsStore.ts's BrandConfig, per Part 2's "avoid duplicate
 * company information... Invoice-specific settings should remain
 * separate" — BrandConfig stays the one source of company identity
 * (logo/name/address/GST/phone/email, read-only here), while this
 * store owns everything that's specific to how invoices themselves
 * are numbered, defaulted, and paid.
 *
 * Bank/UPI fields briefly lived on BrandConfig (Sprint 5) before any
 * settings UI existed for them; this sprint gives them a real home and
 * BrandConfig no longer declares them (see companySettingsStore.ts) —
 * nothing ever shipped a UI to set them there, so there's no existing
 * user data to migrate forward.
 */
export interface InvoiceSettings {
  /** e.g. "INV", "TAX", "BILL" — combined with the year and a
      sequential counter to form the full invoice number
      (INV-2026-0001). See backend/src/services/invoice.service.js's
      nextInvoiceNumber for how a non-default prefix gets its own
      independent counter, so switching prefixes never collides with
      or renumbers invoices already issued under the old one. */
  invoicePrefix: string;
  defaultTaxPercent: number;
  defaultCurrency: CurrencyCode;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  /** Optional — only relevant for international wire transfers. */
  swiftCode: string;
  upiId: string;
  qrCodeDataUri: string | null;
  defaultNotes: string;
  defaultTerms: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureImageUri: string | null;
  /** Shows the company name as a large, faint, rotated background
      watermark across the invoice — same visual treatment
      PDFWatermark.tsx already uses for the Salary payslip
      (showNameWatermark on BrandConfig), reimplemented independently
      here rather than shared so Invoice's on/off toggle is its own
      setting, not tied to the payslip's. */
  showWatermark: boolean;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  invoicePrefix: 'INV',
  defaultTaxPercent: 0,
  defaultCurrency: 'INR',
  /** Sample placeholder bank details — Invoice Settings' "Payment
      Information" card shipped with these fields blank, which meant a
      brand-new invoice's footer just showed "Not configured" until
      someone edited them. These give a fresh install something real to
      show on an invoice out of the box; the account number is always
      masked wherever it's displayed on an invoice (see
      maskAccountNumber below), so shipping a sample value here is safe
      either way — replace all of these with the real account in
      Invoice Settings. */
  bankName: 'HDFC Bank',
  accountHolder: 'Arnas Learning Intelligence Studio Pvt. Ltd.',
  accountNumber: '50100123456789',
  ifscCode: 'HDFC0001234',
  swiftCode: '',
  upiId: 'billing@hdfcbank',
  qrCodeDataUri: null,
  defaultNotes: 'Thank you for your business.',
  defaultTerms:
    'Payment is due within the agreed payment terms from the invoice date. Please quote the invoice number in all correspondence and payment references.',
  signatoryName: '',
  signatoryTitle: 'Authorized Signature',
  signatureImageUri: null,
  showWatermark: false,
};

const STORAGE_KEY = 'arna_invoice_settings_v1';

export function loadInvoiceSettings(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_INVOICE_SETTINGS, ...(JSON.parse(raw) as Partial<InvoiceSettings>) };
    }
  } catch {
    /* ignore — falls through to defaults, same resilience as companySettingsStore.ts */
  }
  return DEFAULT_INVOICE_SETTINGS;
}

export function saveInvoiceSettings(settings: InvoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** Masks a bank account number for display on an invoice — every digit
    except the last 4 becomes '•', grouped in 4s for readability (e.g.
    "50100123456789" → "•••• •••• •• 6789"). Invoice Settings' own form
    still shows/edits the real number (that's the one place it needs to
    be legible to manage it); this is only for wherever the number is
    shown on the invoice itself (InvoiceFooter.tsx / InvoicePdfFooter.tsx),
    which goes out to customers. Short values (<=4 digits) are returned
    as-is — nothing meaningful left to mask. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  const masked = '•'.repeat(digits.length - 4) + digits.slice(-4);
  return (masked.match(/.{1,4}/g) ?? [masked]).join(' ');
}

/** A sanitized prefix is always 2-6 uppercase letters — enforced here
    (not just in the settings form) so a malformed value already saved
    can never silently produce a broken invoice number like
    "undefined-2026-0001". Falls back to the default. */
export function sanitizeInvoicePrefix(value: string): string {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return cleaned.length >= 2 && cleaned.length <= 6 ? cleaned : DEFAULT_INVOICE_SETTINGS.invoicePrefix;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB — generous for a signature/QR image, small enough to keep localStorage happy

/** Part 5 — "Validate uploaded signature image. Validate QR image."
    Neither of these uploads has a backend endpoint (Invoice Settings
    is a localStorage store, same as Company Settings), so this is the
    one place either file is ever checked before being read as a data
    URI. Returns a friendly message on failure, undefined on success —
    callers show the message directly rather than a generic "invalid
    file" banner. */
export function validateSettingsImageFile(file: File): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Please upload a PNG, JPEG, WebP, or SVG image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image is too large — please upload one under 2MB.';
  }
  return undefined;
}
