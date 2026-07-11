import React, { useMemo } from 'react';
import { SalaryHistoryRecord } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Wallet } from 'lucide-react';

interface Props {
  records: SalaryHistoryRecord[];
  month: string;
  year: string;
  fmt: (n: number) => string;
}

function SummaryRow({ label, value, tone, big }: { label: string; value: string; tone?: 'danger'; big?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ fontSize: big ? 12.5 : 12, fontWeight: big ? 700 : 500, color: big ? 'var(--clr-text)' : 'var(--clr-text-muted)' }}>
        {label}
      </span>
      <span style={{
        fontSize: big ? 19 : 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        color: tone === 'danger' ? 'var(--clr-danger)' : 'var(--clr-text)',
      }}>
        {value}
      </span>
    </div>
  );
}

/** Current-period payroll totals, derived entirely from already-
    generated Salary History records (grossSalary/totalDeduction/
    netSalary were computed by the untouched payroll pipeline at
    export time — this panel only sums numbers that already exist). */
export function PayrollSummaryPanel({ records, month, year, fmt }: Props) {
  const periodRecords = useMemo(
    () => records.filter(r => r.month === month && r.year === year),
    [records, month, year]
  );

  if (periodRecords.length === 0) {
    return (
      <Card title="Payroll Summary" icon={<Wallet size={13} />}>
        <EmptyState
          compact
          icon={Wallet}
          title="No payroll generated yet"
          description={`No salary slips have been generated for ${month} ${year}. Use the Salary Generator to create the first one.`}
        />
      </Card>
    );
  }

  const gross = periodRecords.reduce((s, r) => s + r.grossSalary, 0);
  const deductions = periodRecords.reduce((s, r) => s + r.totalDeduction, 0);
  const net = periodRecords.reduce((s, r) => s + r.netSalary, 0);
  const deductionPct = gross > 0 ? Math.round((deductions / gross) * 100) : 0;

  return (
    <Card title="Payroll Summary" icon={<Wallet size={13} />}>
      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', margin: '-4px 0 16px' }}>
        {month} {year} · {periodRecords.length} slip{periodRecords.length === 1 ? '' : 's'} generated
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SummaryRow label="Gross Earnings" value={fmt(gross)} />
        <SummaryRow label="Total Deductions" value={fmt(deductions)} tone="danger" />
        <div style={{ height: 1, background: 'var(--clr-border)' }} />
        <SummaryRow label="Net Payroll" value={fmt(net)} big />
      </div>
      <div className="dist-bar-track" style={{ marginTop: 16 }}>
        <div className="dist-bar-fill" style={{ width: `${deductionPct}%`, background: 'var(--clr-danger)' }} />
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--clr-text-subtle)', marginTop: 6, marginBottom: 0 }}>
        {deductionPct}% of gross earnings went to deductions this period
      </p>
    </Card>
  );
}
