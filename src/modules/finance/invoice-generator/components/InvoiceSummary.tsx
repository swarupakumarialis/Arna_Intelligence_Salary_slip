import React from 'react';
import { InvoiceTotals } from '../../types';
import { CurrencyCode, formatAmount } from '../../../../utils/currencyService';

interface Props {
  totals: InvoiceTotals;
  currency: CurrencyCode;
  accentColor: string;
}

function Row({ label, value, emphasis, valueColor }: { label: string; value: string; emphasis?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: emphasis ? '8px 0 0' : '4px 0' }}>
      <span style={{ fontSize: emphasis ? 12.5 : 11, fontWeight: emphasis ? 700 : 500, color: emphasis ? '#111827' : '#64748B' }}>{label}</span>
      <span style={{ fontSize: emphasis ? 14 : 11.5, fontWeight: 700, color: valueColor || '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

/** Totals block — always fed the exact same InvoiceTotals object the
    form's own Summary card renders (computed once, in
    InvoiceGeneratorPage), so this can never show a different number
    than the form. */
export function InvoiceSummary({ totals, currency, accentColor }: Props) {
  const fmt = (n: number) => formatAmount(n, currency);
  return (
    <div style={{ maxWidth: 260, marginLeft: 'auto', width: '100%' }}>
      <Row label="Subtotal" value={fmt(totals.subtotal)} />
      <Row label="Discount" value={`− ${fmt(totals.discount)}`} />
      <Row label="Taxable Amount" value={fmt(totals.taxableAmount)} />
      <Row label="CGST" value={fmt(totals.cgst)} />
      <Row label="SGST" value={fmt(totals.sgst)} />
      <Row label="Round Off" value={fmt(totals.roundOff)} />
      <div style={{ borderTop: `1.5px solid ${accentColor}`, marginTop: 6 }}>
        <Row label="Grand Total" value={fmt(totals.grandTotal)} emphasis valueColor={accentColor} />
      </div>
    </div>
  );
}
