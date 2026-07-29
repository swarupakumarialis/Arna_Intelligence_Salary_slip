import React from 'react';
import { InvoiceDetails } from '../../types';

interface Props {
  companyName: string;
  companyAddress: string;
  logoDataUri: string | null;
  accentColor: string;
  invoiceNumber: string;
  invoice: InvoiceDetails;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const metaLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em',
};
const metaValueStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: '#1F2937',
};

/** Top-of-invoice band: company identity (logo/name/address — the
    same BrandConfig every other document in this app already reads,
    via loadCompanySettings; see InvoicePreview.tsx) on the left,
    "INVOICE" title + number/date/due-date/terms on the right. */
export function InvoiceHeader({ companyName, companyAddress, logoDataUri, accentColor, invoiceNumber, invoice }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
        {logoDataUri && (
          <img src={logoDataUri} alt={companyName} style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{companyName}</p>
          {companyAddress && (
            <p style={{ fontSize: 10.5, color: '#64748B', margin: '4px 0 0', whiteSpace: 'pre-line', lineHeight: 1.5, maxWidth: 260 }}>
              {companyAddress}
            </p>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: accentColor, margin: 0, letterSpacing: '0.03em' }}>INVOICE</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 10px', marginTop: 10, justifyContent: 'end' }}>
          <span style={{ ...metaLabelStyle, textAlign: 'right' }}>Invoice No.</span>
          <span style={{ ...metaValueStyle, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{invoiceNumber}</span>
          <span style={{ ...metaLabelStyle, textAlign: 'right' }}>Invoice Date</span>
          <span style={{ ...metaValueStyle, textAlign: 'right' }}>{formatDate(invoice.invoiceDate)}</span>
          <span style={{ ...metaLabelStyle, textAlign: 'right' }}>Due Date</span>
          <span style={{ ...metaValueStyle, textAlign: 'right' }}>{formatDate(invoice.dueDate)}</span>
          <span style={{ ...metaLabelStyle, textAlign: 'right' }}>Payment Terms</span>
          <span style={{ ...metaValueStyle, textAlign: 'right' }}>{invoice.paymentTerms}</span>
        </div>
      </div>
    </div>
  );
}
