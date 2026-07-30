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
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  invoicePrefix: 'INV',
  defaultTaxPercent: 0,
  defaultCurrency: 'INR',
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  upiId: '',
  qrCodeDataUri: null,
  defaultNotes: 'Thank you for your business.',
  defaultTerms:
    'Payment is due within the agreed payment terms from the invoice date. Please quote the invoice number in all correspondence and payment references.',
  signatoryName: '',
  signatoryTitle: 'Authorized Signature',
  signatureImageUri: null,
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
