import React from 'react';
import { InvoiceItem } from '../../types';
import { CurrencyCode, formatAmount } from '../../../../utils/currencyService';
import { lineAmount } from '../../utils';

interface Props {
  items: InvoiceItem[];
  currency: CurrencyCode;
  accentColor: string;
}

const LINE = '#E2E8F0';
const LINE_SOFT = '#EEF1F5';

/** Bordered items table — PDF-layout counterpart of the screen
    preview's InvoiceItemsTable.tsx, styled after this app's other
    dedicated-PDF table (PDFSalaryTable.tsx: bordered container, light
    gray header, alternating row background). Renders exactly one row
    per item — "automatic row expansion" per the spec, no padding to a
    fixed minimum row count, since an invoice's item count is
    unbounded and the PDF/print output must never clip it. */
export function InvoicePdfItems({ items, currency, accentColor }: Props) {
  const cols = '1fr 60px 90px 60px 100px';

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, backgroundColor: '#F8FAFC', borderBottom: `1px solid ${LINE}` }}>
        {['Description', 'Qty', 'Unit Price', 'Tax %', 'Amount'].map((h, i) => (
          <div key={h} style={{
            padding: '7px 10px', fontSize: '7pt', fontWeight: 700, color: accentColor,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            textAlign: i === 0 ? 'left' : 'right',
          }}>
            {h}
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '14px 10px', fontSize: '8pt', color: '#CBD5E1', fontStyle: 'italic', textAlign: 'center' }}>
          No items added
        </div>
      ) : (
        items.map((item, idx) => (
          <div key={item.id} style={{
            display: 'grid', gridTemplateColumns: cols,
            backgroundColor: idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF',
            borderBottom: idx === items.length - 1 ? 'none' : `1px solid ${LINE_SOFT}`,
          }}>
            <div style={{ padding: '7px 10px', fontSize: '8pt', color: '#1F2937', wordBreak: 'break-word' }}>{item.description || '—'}</div>
            <div style={{ padding: '7px 10px', fontSize: '8pt', color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</div>
            <div style={{ padding: '7px 10px', fontSize: '8pt', color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(item.unitPrice, currency)}</div>
            <div style={{ padding: '7px 10px', fontSize: '8pt', color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.taxPercent}%</div>
            <div style={{ padding: '7px 10px', fontSize: '8pt', fontWeight: 700, color: '#111827', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(lineAmount(item), currency)}</div>
          </div>
        ))
      )}
    </div>
  );
}
