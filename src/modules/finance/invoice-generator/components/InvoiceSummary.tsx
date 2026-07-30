import React from 'react';
import { InvoiceTotals } from '../../types';
import { CurrencyCode, formatAmount } from '../../../../utils/currencyService';

interface Props {
  totals: InvoiceTotals;
  currency: CurrencyCode;
  accentColor: string;
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: muted ? '#94A3B8' : '#64748B' }}>{label}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: muted ? '#94A3B8' : '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

/** Totals block — always fed the exact same InvoiceTotals object the
    form's own Summary card renders (computed once, in
    InvoiceGeneratorPage), so this can never show a different number
    than the form. Sprint 6 premium redesign: running totals sit in a
    plain column, then Grand Total gets its own filled accent bar —
    the "impossible to miss the number that matters" treatment Stripe/
    QuickBooks invoices use, rather than just a bigger font weight. */
export function InvoiceSummary({ totals, currency, accentColor }: Props) {
  const fmt = (n: number) => formatAmount(n, currency);
  return (
    <div style={{ maxWidth: 280, marginLeft: 'auto', width: '100%' }}>
      <div style={{ padding: '2px 4px' }}>
        <Row label="Subtotal" value={fmt(totals.subtotal)} />
        {totals.discount > 0 && <Row label="Discount" value={`− ${fmt(totals.discount)}`} muted />}
        <Row label="Taxable Amount" value={fmt(totals.taxableAmount)} />
        <Row label="CGST" value={fmt(totals.cgst)} />
        <Row label="SGST" value={fmt(totals.sgst)} />
        {totals.roundOff !== 0 && <Row label="Round Off" value={fmt(totals.roundOff)} muted />}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        marginTop: 8, padding: '10px 14px', borderRadius: 6, background: accentColor,
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Grand Total
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(totals.grandTotal)}
        </span>
      </div>
    </div>
  );
}
