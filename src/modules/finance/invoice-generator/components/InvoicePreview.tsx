import React, { useMemo } from 'react';
import { CustomerDetails, InvoiceDetails, InvoiceItem, InvoiceTotals } from '../../types';
import { loadCompanySettings } from '../../../../utils/companySettingsStore';
import { loadInvoiceSettings } from '../../utils/invoiceSettingsStore';
import { InvoiceHeader } from './InvoiceHeader';
import { InvoiceMeta } from './InvoiceMeta';
import { InvoiceCustomer } from './InvoiceCustomer';
import { InvoiceItemsTable } from './InvoiceItemsTable';
import { InvoiceSummary } from './InvoiceSummary';
import { InvoiceFooter } from './InvoiceFooter';

interface Props {
  customer: CustomerDetails;
  invoice: InvoiceDetails;
  invoiceNumber: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  notes: string;
  terms: string;
}

/** A4-proportioned (794×1123px @ 96dpi — matches the same pixel
    reference the Salary Generator's zoom math uses, see App.tsx's
    A4_PX_WIDTH/A4_PX_HEIGHT) live invoice document. Composes the
    section components below; owns no state of its own — every value
    shown here is a prop, sourced from InvoiceGeneratorPage's own
    form state, so the preview can never hold a second copy of the
    invoice. Company identity (logo/name/address) is the one
    exception: it reads the same BrandConfig every other document in
    this app already reads via loadCompanySettings — read-only, never
    written here, and independent of SalarySlipPreview itself.

    Sprint 6 premium redesign: a colored top accent bar (the "branded
    paper" look Stripe/QuickBooks invoices use), a two-column info band
    (Bill To + Invoice Details side by side, replacing the old single-
    column stack), and generous, print-realistic margins. */
export function InvoicePreview({ customer, invoice, invoiceNumber, items, totals, notes, terms }: Props) {
  const brand = useMemo(() => loadCompanySettings(), []);
  const settings = useMemo(() => loadInvoiceSettings(), []);
  const accentColor = brand.primaryColour || '#0F172A';

  return (
    <div
      id="invoice-preview-area"
      style={{
        width: 794,
        minHeight: 1123,
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: 6, background: accentColor, flexShrink: 0 }} />
      <div style={{
        padding: '40px 52px 52px',
        fontFamily: "'Inter', 'Segoe UI', system-ui, Arial, sans-serif",
        color: '#1F2937',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        flex: 1,
      }}>
        <InvoiceHeader
          companyName={brand.companyName || 'Company Name'}
          companyAddress={brand.companyAddress || ''}
          logoDataUri={brand.logoDataUri}
          accentColor={accentColor}
          invoice={invoice}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, paddingBottom: 24, borderBottom: '1px solid #EEF1F5' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <InvoiceCustomer customer={customer} accentColor={accentColor} />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <InvoiceMeta invoiceNumber={invoiceNumber} invoice={invoice} accentColor={accentColor} />
          </div>
        </div>

        <InvoiceItemsTable items={items} currency={invoice.currency} accentColor={accentColor} />
        <div style={{ flex: 1 }} />
        <InvoiceSummary totals={totals} currency={invoice.currency} accentColor={accentColor} />
        <InvoiceFooter settings={settings} accentColor={accentColor} notes={notes} terms={terms} />
      </div>
    </div>
  );
}
