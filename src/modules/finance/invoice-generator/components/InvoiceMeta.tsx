import React from 'react';
import { InvoiceDetails } from '../../types';

interface Props {
  invoiceNumber: string;
  invoice: InvoiceDetails;
  accentColor: string;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const rowLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em',
};
const rowValue: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: '#1F2937', textAlign: 'right',
};

/** Invoice essentials (Sprint 6) — split out of InvoiceHeader so the
    preview's info band can show Bill To and these details side by
    side, a two-column layout matching how Stripe/QuickBooks/FreshBooks
    lay out this section, rather than cramming it into the top header
    band. Right-aligned to visually pair with InvoiceCustomer's
    left-aligned Bill To block. */
export function InvoiceMeta({ invoiceNumber, invoice, accentColor }: Props) {
  return (
    <div>
      <p style={{
        fontSize: 9.5, fontWeight: 700, color: accentColor, textTransform: 'uppercase',
        letterSpacing: '0.08em', margin: '0 0 8px', textAlign: 'right',
      }}>
        Invoice Details
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '5px 14px', justifyContent: 'end' }}>
        <span style={rowLabel}>Invoice No.</span>
        <span style={{ ...rowValue, fontFamily: 'ui-monospace, monospace' }}>{invoiceNumber}</span>
        <span style={rowLabel}>Invoice Date</span>
        <span style={rowValue}>{formatDate(invoice.invoiceDate)}</span>
        <span style={rowLabel}>Due Date</span>
        <span style={rowValue}>{formatDate(invoice.dueDate)}</span>
        <span style={rowLabel}>Payment Terms</span>
        <span style={rowValue}>{invoice.paymentTerms}</span>
      </div>
    </div>
  );
}
