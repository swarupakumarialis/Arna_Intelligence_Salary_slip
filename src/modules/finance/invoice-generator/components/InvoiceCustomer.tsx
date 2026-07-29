import React from 'react';
import { CustomerDetails } from '../../types';

interface Props {
  customer: CustomerDetails;
  accentColor: string;
}

/** "Bill To" block — reflects the Customer Details section of the
    form field-for-field, live. Blank fields are simply omitted rather
    than shown as "—", so an in-progress invoice doesn't read as full
    of placeholders before the user has filled anything in. */
export function InvoiceCustomer({ customer, accentColor }: Props) {
  const hasAnything = Object.values(customer).some(v => v.trim().length > 0);

  return (
    <div>
      <p style={{
        fontSize: 9.5, fontWeight: 700, color: accentColor, textTransform: 'uppercase',
        letterSpacing: '0.08em', margin: '0 0 6px',
      }}>
        Bill To
      </p>
      {hasAnything ? (
        <div>
          {customer.customerName && <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{customer.customerName}</p>}
          {customer.companyName && <p style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', margin: '2px 0 0' }}>{customer.companyName}</p>}
          {customer.billingAddress && <p style={{ fontSize: 10.5, color: '#64748B', margin: '4px 0 0', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{customer.billingAddress}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 6, fontSize: 10.5, color: '#64748B' }}>
            {customer.gstin && <span>GSTIN: <strong style={{ color: '#374151' }}>{customer.gstin}</strong></span>}
            {customer.email && <span>{customer.email}</span>}
            {customer.phone && <span>{customer.phone}</span>}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>Customer details will appear here</p>
      )}
    </div>
  );
}
