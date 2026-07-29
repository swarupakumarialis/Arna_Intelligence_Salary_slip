import React from 'react';
import { InvoiceItem } from '../../types';
import { lineAmount } from '../../utils';
import { CurrencyCode, formatAmount } from '../../../../utils/currencyService';

interface Props {
  items: InvoiceItem[];
  currency: CurrencyCode;
  accentColor: string;
}

const th: React.CSSProperties = {
  padding: '8px 10px', fontSize: 9, fontWeight: 700, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #1F2937',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '8px 10px', fontSize: 11, color: '#1F2937', borderBottom: '1px solid #EEF1F5', verticalAlign: 'top',
};

/** Read-only mirror of the form's Items table — same columns, same
    derived Amount (qty × unitPrice), no inputs. */
export function InvoiceItemsTable({ items, currency, accentColor }: Props) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ background: '#F8FAFC' }}>
          <th style={{ ...th, textAlign: 'left', borderBottomColor: accentColor }}>Description</th>
          <th style={{ ...th, textAlign: 'right', borderBottomColor: accentColor }}>Qty</th>
          <th style={{ ...th, textAlign: 'right', borderBottomColor: accentColor }}>Unit Price</th>
          <th style={{ ...th, textAlign: 'right', borderBottomColor: accentColor }}>Tax %</th>
          <th style={{ ...th, textAlign: 'right', borderBottomColor: accentColor }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td style={{ ...td, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }} colSpan={5}>No items added yet</td>
          </tr>
        ) : (
          items.map((item, i) => (
            <tr key={item.id}>
              <td style={td}>{item.description || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Item {i + 1}</span>}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.quantity || 0}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(Number(item.unitPrice) || 0, currency)}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.taxPercent || 0}%</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(lineAmount(item), currency)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
