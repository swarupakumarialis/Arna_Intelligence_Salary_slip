import React from 'react';
import { SalaryItem } from '../../types';

interface Props {
  earnings: SalaryItem[];
  deductions: SalaryItem[];
  fmt: (n: number) => string;
  primary: string;
}

const LINE = '#E2E8F0';
const LINE_SOFT = '#EEF1F5';
const HEADER_BG = '#F8FAFC';

/**
 * Earnings / deductions table. Row height and font size step down as
 * row count grows, so a heavy payslip (many earnings or deductions)
 * compresses to keep fitting the table's share of the page instead of
 * ever pushing content past it — dynamic, not fixed.
 */
export function PDFSalaryTable({ earnings, deductions, fmt, primary }: Props) {
  const dataRows = Math.max(earnings.length, deductions.length);
  const minRows = Math.max(dataRows, 8);

  const rowPadY        = dataRows > 16 ? 3   : dataRows > 12 ? 5    : dataRows > 9 ? 7    : 8;
  const cellFontSize    = dataRows > 16 ? '6.5pt' : dataRows > 12 ? '7pt' : dataRows > 9 ? '7.5pt' : '8pt';
  const cellLineHeight  = dataRows > 12 ? 1.3 : 1.45;

  const cellSt: React.CSSProperties = {
    padding: `${rowPadY}px 12px`,
    fontSize: cellFontSize,
    lineHeight: cellLineHeight,
    color: '#1F2937',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div style={{
      flex: 1, marginBottom: 9, minHeight: 0,
      border: `1px solid ${LINE}`, borderRadius: 4, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — light gray, bold, no dark fill */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 104px 1fr 104px', backgroundColor: HEADER_BG, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <div style={{ padding: '7px 12px', fontSize: '7pt', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Earnings</div>
        <div style={{ padding: '7px 12px', fontSize: '7pt', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>Amount</div>
        <div style={{ padding: '7px 12px', fontSize: '7pt', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.07em', borderLeft: `1px solid ${LINE}` }}>Deductions</div>
        <div style={{ padding: '7px 12px', fontSize: '7pt', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>Amount</div>
      </div>

      {/* Body — alternating row background */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {Array.from({ length: minRows }).map((_, idx) => {
          const e = earnings[idx];
          const d = deductions[idx];
          return (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '1fr 104px 1fr 104px',
              backgroundColor: idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF',
              borderBottom: `1px solid ${LINE_SOFT}`,
            }}>
              <div style={cellSt}>{e?.name || ''}</div>
              <div style={{ ...cellSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: e?.amount ? '#111827' : 'transparent' }}>
                {e?.amount ? fmt(e.amount) : '·'}
              </div>
              <div style={{ ...cellSt, borderLeft: `1px solid ${LINE_SOFT}` }}>{d?.name || ''}</div>
              <div style={{ ...cellSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: d?.amount ? '#111827' : 'transparent' }}>
                {d?.amount ? fmt(d.amount) : '·'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
