import React from 'react';
import { withAlpha } from '../../utils/color';

interface Props {
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  fmt: (n: number) => string;
  primary: string;
}

/** One summary row — Net Pay highlighted with a brand border + light
    brand tint, never a solid dark fill. */
export function PDFTotals({ totalEarnings, totalDeductions, netPay, fmt, primary }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexShrink: 0 }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 4 }}>
        <span style={{ fontSize: '7.5pt', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Earnings</span>
        <span style={{ fontSize: '10pt', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalEarnings)}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 4 }}>
        <span style={{ fontSize: '7.5pt', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Deductions</span>
        <span style={{ fontSize: '10pt', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalDeductions)}</span>
      </div>
      <div style={{
        flex: 1.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', border: `1.5px solid ${primary}`, borderRadius: 4,
        backgroundColor: withAlpha(primary, '08'),
      }}>
        <span style={{ fontSize: '8pt', fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Pay</span>
        <span style={{ fontSize: '15pt', fontWeight: 800, color: primary, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(netPay)}</span>
      </div>
    </div>
  );
}
