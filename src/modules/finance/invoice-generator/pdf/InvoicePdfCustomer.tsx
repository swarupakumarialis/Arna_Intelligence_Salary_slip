import React from 'react';
import { CustomerDetails } from '../../types';

interface Props {
  customer: CustomerDetails;
  accentColor: string;
}

/** "Bill To" block — PDF-layout counterpart of the screen preview's
    InvoiceCustomer.tsx, same field set, pt/mm sizing instead of px. */
export function InvoicePdfCustomer({ customer, accentColor }: Props) {
  const isEmpty = !customer.customerName.trim() && !customer.companyName.trim() && !customer.billingAddress.trim();

  return (
    <div>
      <p style={{ fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accentColor, margin: '0 0 6px' }}>
        Bill To
      </p>
      {isEmpty ? (
        <p style={{ fontSize: '8pt', color: '#CBD5E1', fontStyle: 'italic', margin: 0 }}>Customer details will appear here</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {customer.customerName && <div style={{ fontSize: '10pt', fontWeight: 700, color: '#111827' }}>{customer.customerName}</div>}
          {customer.companyName && <div style={{ fontSize: '8.5pt', fontWeight: 600, color: '#374151' }}>{customer.companyName}</div>}
          {customer.billingAddress && (
            <div style={{ fontSize: '7.5pt', color: '#64748B', lineHeight: 1.5, whiteSpace: 'pre-line', maxWidth: 320 }}>{customer.billingAddress}</div>
          )}
          {customer.gstin && <div style={{ fontSize: '7.5pt', color: '#64748B' }}>GSTIN: <span style={{ fontWeight: 600, color: '#374151' }}>{customer.gstin}</span></div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            {customer.email && <span style={{ fontSize: '7.5pt', color: '#64748B' }}>{customer.email}</span>}
            {customer.phone && <span style={{ fontSize: '7.5pt', color: '#64748B' }}>{customer.phone}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
