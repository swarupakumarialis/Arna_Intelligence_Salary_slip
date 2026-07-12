import React, { useMemo } from 'react';
import { SalaryHistoryRecord } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { BarChart } from './charts/BarChart';
import { BarChart3 } from 'lucide-react';

interface Props {
  records: SalaryHistoryRecord[];
  fmt: (n: number) => string;
}

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** How many "% of gross" a month's net payroll gets in the trend below
    — this panel shows the last 6 periods that actually have data, so a
    fresh install with one or two months of history doesn't render five
    empty bars. */
const MAX_PERIODS = 6;

/** Total net payroll per month/year, purely aggregated from the
    already-computed netSalary on each existing Salary History record
    (Sprint 5.6 — presentation only, no new calculation logic; every
    number here already exists on the records App.tsx passes down). */
export function MonthlyPayrollPanel({ records, fmt }: Props) {
  const periods = useMemo(() => {
    const totals = new Map<string, { month: string; year: string; total: number }>();
    records.forEach(r => {
      const key = `${r.month}-${r.year}`;
      const existing = totals.get(key);
      if (existing) existing.total += r.netSalary;
      else totals.set(key, { month: r.month, year: r.year, total: r.netSalary });
    });
    return Array.from(totals.values())
      .sort((a, b) => {
        if (a.year !== b.year) return Number(a.year) - Number(b.year);
        return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
      })
      .slice(-MAX_PERIODS);
  }, [records]);

  if (periods.length === 0) {
    return (
      <Card title="Monthly Payroll" icon={<BarChart3 size={13} />}>
        <EmptyState
          compact
          icon={BarChart3}
          title="No payroll trend yet"
          description="Generate salary slips across a few months to see the payroll trend here."
        />
      </Card>
    );
  }

  return (
    <Card title="Monthly Payroll" icon={<BarChart3 size={13} />}>
      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', margin: '-4px 0 4px' }}>
        Net payroll, last {periods.length} period{periods.length === 1 ? '' : 's'}
      </p>
      <BarChart
        data={periods.map(p => ({ label: `${p.month.slice(0, 3)} ${p.year.slice(2)}`, value: p.total }))}
        color="var(--arna-navy)"
        formatValue={fmt}
        height={190}
      />
    </Card>
  );
}
