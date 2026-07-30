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
  padding: '10px 12px', fontSize: 9, fontWeight: 700, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px 12px', fontSize: 11, color: '#1F2937', verticalAlign: 'top',
};

/** Read-only mirror of the form's Items table — same columns, same
    derived Amount (qty × unitPrice), no inputs. Sprint 6 premium
    redesign: bordered container (not just a bottom rule per row),
    tinted header row, subtle zebra striping — matches the bordered-
    card table treatment InvoicePdfItems.tsx and this app's other
    dedicated tables (PDFSalaryTable.tsx) already use, so the screen
    preview and the generated PDF read as the same document. */
export function InvoiceItemsTable({ items, currency, accentColor }: Props) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: `2px solid ${accentColor}` }}>
            <th style={{ ...th, textAlign: 'left' }}>Description</th>
            <th style={{ ...th, textAlign: 'right', width: 64 }}>Qty</th>
            <th style={{ ...th, textAlign: 'right', width: 100 }}>Unit Price</th>
            <th style={{ ...th, textAlign: 'right', width: 64 }}>Tax %</th>
            <th style={{ ...th, textAlign: 'right', width: 110 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td style={{ ...td, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', padding: '20px 12px' }} colSpan={5}>
                No items added yet
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr key={item.id} style={{ background: i % 2 === 1 ? '#FAFBFC' : '#FFFFFF', borderTop: '1px solid #EEF1F5' }}>
                <td style={td}>{item.description || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Item {i + 1}</span>}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.quantity || 0}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(Number(item.unitPrice) || 0, currency)}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.taxPercent || 0}%</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(lineAmount(item), currency)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
