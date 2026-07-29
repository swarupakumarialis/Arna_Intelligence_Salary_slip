import React, { useMemo } from 'react';
import { CustomerDetails, InvoiceDetails, InvoiceItem, InvoiceTotals } from '../../types';
import { loadCompanySettings } from '../../../../utils/companySettingsStore';
import { InvoiceHeader } from './InvoiceHeader';
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
    written here, and independent of SalarySlipPreview itself. */
export function InvoicePreview({ customer, invoice, invoiceNumber, items, totals }: Props) {
  const brand = useMemo(() => loadCompanySettings(), []);
  const accentColor = brand.primaryColour || '#0F172A';

  return (
    <div
      id="invoice-preview-area"
      style={{
        width: 794,
        minHeight: 1123,
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        boxSizing: 'border-box',
        padding: '44px 48px',
        fontFamily: "'Inter', 'Segoe UI', system-ui, Arial, sans-serif",
        color: '#1F2937',
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
      }}
    >
      <InvoiceHeader
        companyName={brand.companyName || 'Company Name'}
        companyAddress={brand.companyAddress || ''}
        logoDataUri={brand.logoDataUri}
        accentColor={accentColor}
        invoiceNumber={invoiceNumber}
        invoice={invoice}
      />
      <InvoiceCustomer customer={customer} accentColor={accentColor} />
      <InvoiceItemsTable items={items} currency={invoice.currency} accentColor={accentColor} />
      <InvoiceSummary totals={totals} currency={invoice.currency} accentColor={accentColor} />
      <div style={{ flex: 1 }} />
      <InvoiceFooter accentColor={accentColor} />
    </div>
  );
}
