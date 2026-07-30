import { InvoiceItem, InvoiceTotals } from '../types';
import { loadInvoiceSettings } from './invoiceSettingsStore';

/**
 * Finance module — Invoice utilities (Sprint 3). Shared by
 * InvoiceGeneratorPage (the form) and, indirectly, everything the
 * page passes down to the live preview — the preview never
 * recomputes totals itself, it only ever renders the InvoiceTotals
 * object this function produced.
 */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Local-only React list key — never persisted (see services/invoiceApi.ts's
    fromApiRecord, which regenerates one of these per item loaded from
    the backend, since the backend's item subdocuments carry no id). */
export function makeItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Sprint 7 — taxPercent defaults from Invoice Settings' configured
    default tax percentage rather than a hardcoded 0, so a new row
    already reflects what most items on this invoice will need. */
export function createBlankInvoiceItem(): InvoiceItem {
  return { id: makeItemId(), description: '', quantity: 1, unitPrice: 0, taxPercent: loadInvoiceSettings().defaultTaxPercent };
}

/** Subtotal/tax are computed per item (qty × unitPrice, and that
    amount's own tax%), summed, then discount is taken off the
    subtotal before rounding. CGST/SGST are the standard Indian GST
    even split of the total computed tax — a later sprint can replace
    this with real state-specific/interstate rules once those
    requirements exist; this is a transparent placeholder formula,
    not a certified tax engine. */
export function computeInvoiceTotals(items: InvoiceItem[], discount: number): InvoiceTotals {
  let subtotal = 0;
  let totalTax = 0;
  for (const item of items) {
    const lineAmount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    subtotal += lineAmount;
    totalTax += lineAmount * ((Number(item.taxPercent) || 0) / 100);
  }
  const safeDiscount = Math.min(Number(discount) || 0, subtotal);
  const taxableAmount = subtotal - safeDiscount;
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const rawTotal = taxableAmount + totalTax;
  const grandTotal = Math.round(rawTotal);
  const roundOff = grandTotal - rawTotal;
  return { subtotal, discount: safeDiscount, taxableAmount, cgst, sgst, roundOff, grandTotal };
}

export function lineAmount(item: InvoiceItem): number {
  return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
}
