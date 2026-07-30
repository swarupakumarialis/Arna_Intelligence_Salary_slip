import React from 'react';
import { BrandConfig } from '../../../../utils/companySettingsStore';
import { InvoiceDetails } from '../../types';

interface Props {
  brand: BrandConfig;
  invoice: InvoiceDetails;
  accentColor: string;
}

const STATUS_COLOR: Record<InvoiceDetails['status'], string> = {
  Draft: '#64748B', Sent: '#0F766E', Paid: '#15803D', 'Partially Paid': '#B45309', Overdue: '#B91C1C', Cancelled: '#64748B',
};

/** Company identity (left) + INVOICE title/status (right) — the PDF
    equivalent of the screen preview's InvoiceHeader. Sprint 6: Invoice
    Number/Date/Due Date moved out into InvoicePdfMeta (mirroring the
    screen preview's own InvoiceHeader/InvoiceMeta split), and Status
    replaces the old plain-text meta row with a colored label, matching
    the screen preview's StatusBadge treatment. */
export function InvoicePdfHeader({ brand, invoice, accentColor }: Props) {
  const contactLine = [brand.gstin && `GSTIN: ${brand.gstin}`, brand.phone, brand.email].filter(Boolean).join('   ·   ');

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, paddingBottom: 14, borderBottom: `2px solid ${accentColor}` }}>
      <div style={{ flex: '0 0 58%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {brand.logoDataUri && (
          <img src={brand.logoDataUri} alt={brand.companyName} style={{ width: 120, height: 38, objectFit: 'contain', objectPosition: 'left center', marginBottom: 2 }} />
        )}
        <div style={{ fontSize: '14pt', fontWeight: 800, color: accentColor, lineHeight: 1.3 }}>
          {brand.companyName || 'Company Name'}
        </div>
        {brand.companyAddress && (
          <div style={{ fontSize: '7.5pt', color: '#64748B', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
            {brand.companyAddress.split(/\n+/).map(s => s.trim()).filter(Boolean).join(', ')}
          </div>
        )}
        {contactLine && <div style={{ fontSize: '7.5pt', color: '#94A3B8' }}>{contactLine}</div>}
      </div>

      <div style={{ flex: '0 0 38%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ fontSize: '19pt', fontWeight: 800, color: '#111827', letterSpacing: '0.05em' }}>INVOICE</div>
        <div style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 4,
          fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: STATUS_COLOR[invoice.status], border: `1.5px solid ${STATUS_COLOR[invoice.status]}`,
        }}>
          {invoice.status}
        </div>
      </div>
    </div>
  );
}
