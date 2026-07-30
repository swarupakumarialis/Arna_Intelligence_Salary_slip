import React from 'react';
import { InvoiceDetails } from '../../types';

interface Props {
  invoiceNumber: string;
  invoice: InvoiceDetails;
  accentColor: string;
}

function formatDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Invoice essentials — PDF-layout counterpart of the screen preview's
    InvoiceMeta.tsx (Sprint 6), split out of InvoicePdfHeader so this
    can sit right-aligned opposite InvoicePdfCustomer's Bill To block,
    the same two-column info band the screen preview now uses. */
export function InvoicePdfMeta({ invoiceNumber, invoice, accentColor }: Props) {
  return (
    <div>
      <p style={{ fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accentColor, margin: '0 0 6px', textAlign: 'right' }}>
        Invoice Details
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px', fontSize: '8pt', justifyContent: 'end' }}>
        <span style={{ color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>Invoice No.</span>
        <span style={{ color: '#111827', fontWeight: 700, fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>{invoiceNumber}</span>
        <span style={{ color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>Invoice Date</span>
        <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right' }}>{formatDate(invoice.invoiceDate)}</span>
        <span style={{ color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>Due Date</span>
        <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right' }}>{formatDate(invoice.dueDate)}</span>
        <span style={{ color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>Payment Terms</span>
        <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right' }}>{invoice.paymentTerms}</span>
      </div>
    </div>
  );
}
