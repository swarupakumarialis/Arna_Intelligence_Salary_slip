import React from 'react';
import { InvoiceTotals } from '../../types';
import { CurrencyCode, amountToWords, formatAmount } from '../../../../utils/currencyService';

interface Props {
  totals: InvoiceTotals;
  currency: CurrencyCode;
  accentColor: string;
}

function Row({ label, value, emphasis, valueColor }: { label: string; value: string; emphasis?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: emphasis ? '7px 0 0' : '3px 0' }}>
      <span style={{ fontSize: emphasis ? '9pt' : '8pt', fontWeight: emphasis ? 700 : 500, color: emphasis ? '#111827' : '#64748B' }}>{label}</span>
      <span style={{ fontSize: emphasis ? '11pt' : '8pt', fontWeight: 700, color: valueColor || '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

/** Totals block — PDF-layout counterpart of the screen preview's
    InvoiceSummary.tsx. Grand Total visually emphasized per spec: larger
    type, accent color, a top border separating it from the running
    totals above it. */
export function InvoicePdfSummary({ totals, currency, accentColor }: Props) {
  const fmt = (n: number) => formatAmount(n, currency);
  return (
    <div style={{ maxWidth: 260, marginLeft: 'auto', width: '100%' }}>
      <Row label="Subtotal" value={fmt(totals.subtotal)} />
      <Row label="Discount" value={`− ${fmt(totals.discount)}`} />
      <Row label="Taxable Amount" value={fmt(totals.taxableAmount)} />
      <Row label="CGST" value={fmt(totals.cgst)} />
      <Row label="SGST" value={fmt(totals.sgst)} />
      <Row label="Round Off" value={fmt(totals.roundOff)} />
      <div style={{ borderTop: `1.5px solid ${accentColor}`, marginTop: 5 }}>
        <Row label="Grand Total" value={fmt(totals.grandTotal)} emphasis valueColor={accentColor} />
      </div>
      {/* Amount in Words — same bordered label+value strip convention as
          the Salary payslip PDF's "Amount in Words" (SalarySlipPDF.tsx). */}
      <div style={{
        marginTop: 6, border: '1px solid #E2E8F0', borderRadius: 4, padding: '6px 10px',
        display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', flexShrink: 0 }}>
          Amount in Words
        </span>
        <span style={{ fontSize: '8.5pt', fontWeight: 600, color: '#1F2937' }}>
          {amountToWords(totals.grandTotal, currency)}
        </span>
      </div>
    </div>
  );
}
