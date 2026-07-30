import React, { useMemo } from 'react';
import { CustomerDetails, InvoiceDetails, InvoiceItem, InvoiceTotals } from '../../types';
import { loadCompanySettings } from '../../../../utils/companySettingsStore';
import { loadInvoiceSettings } from '../../utils/invoiceSettingsStore';
import { InvoicePdfHeader } from './InvoicePdfHeader';
import { InvoicePdfMeta } from './InvoicePdfMeta';
import { InvoicePdfCustomer } from './InvoicePdfCustomer';
import { InvoicePdfItems } from './InvoicePdfItems';
import { InvoicePdfSummary } from './InvoicePdfSummary';
import { InvoicePdfFooter } from './InvoicePdfFooter';
import { InvoicePdfWatermark } from './InvoicePdfWatermark';

interface Props {
  customer: CustomerDetails;
  invoice: InvoiceDetails;
  invoiceNumber: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  notes: string;
  terms: string;
  pdfRef: React.RefObject<HTMLDivElement | null>;
}

/** DOM id generateInvoicePdf.ts looks for when slicing the captured
    canvas into pages — the Summary+Footer block, so a page break can
    never land inside it (Part 4 — "never split totals awkwardly
    across pages... keep footer together"). Also gets `breakInside:
    'avoid'` for the native Print path, which respects it directly. */
export const KEEP_TOGETHER_ID = 'invoice-summary-footer';

/**
 * Dedicated PDF/print rendering layer (Sprint 5) — a separate
 * component tree from InvoicePreview (the screen preview), same
 * relationship SalarySlipPDF.tsx has to SalarySlipPreview.tsx in this
 * app: same business data (customer/invoice/items/totals — nothing
 * here computes a number), entirely its own layout, built for two
 * jobs: (1) html2canvas capture for Download PDF, (2) the literal
 * subtree the browser prints for Print Invoice. Unlike SalarySlipPDF,
 * this container is NOT height-clamped to one A4 page — an invoice's
 * item count is unbounded, so it grows naturally past 297mm when it
 * has to; see generateInvoicePdf.ts for how Download PDF slices that
 * into multiple pages, and the print CSS for how native browser
 * pagination handles it automatically.
 *
 * Sprint 7 — margins/gaps tightened (14mm→10mm, 16px→12px) per Part 4
 * ("reduce unnecessary padding... prevent wasted blank space"), now
 * that the compact footer (InvoicePdfFooter.tsx) needs far less room
 * than the old vertical stack did.
 */
export function InvoicePdf({ customer, invoice, invoiceNumber, items, totals, notes, terms, pdfRef }: Props) {
  const brand = useMemo(() => loadCompanySettings(), []);
  const settings = useMemo(() => loadInvoiceSettings(), []);
  const accentColor = brand.primaryColour || '#0F172A';
  const generatedDate = useMemo(
    () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    []
  );

  return (
    <div
      ref={pdfRef}
      id="invoice-pdf-area"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Segoe UI', system-ui, Arial, sans-serif",
        color: '#111827',
        backgroundColor: '#ffffff',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <InvoicePdfWatermark show={settings.showWatermark} companyName={brand.companyName} primary={accentColor} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <InvoicePdfHeader brand={brand} invoice={invoice} accentColor={accentColor} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, paddingBottom: 10, borderBottom: '1px solid #EEF1F5' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <InvoicePdfCustomer customer={customer} accentColor={accentColor} />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <InvoicePdfMeta invoiceNumber={invoiceNumber} invoice={invoice} accentColor={accentColor} />
          </div>
        </div>
        <InvoicePdfItems items={items} currency={invoice.currency} accentColor={accentColor} />
        <div style={{ flex: 1 }} />
        <div id={KEEP_TOGETHER_ID} style={{ breakInside: 'avoid', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InvoicePdfSummary totals={totals} currency={invoice.currency} accentColor={accentColor} />
          <InvoicePdfFooter settings={settings} accentColor={accentColor} generatedDate={generatedDate} notes={notes} terms={terms} />
        </div>
      </div>
    </div>
  );
}
