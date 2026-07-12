import React, { useMemo } from 'react';
import { SalaryHistoryRecord } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { BarChart } from './charts/BarChart';
import { Coins } from 'lucide-react';

interface Props {
  records: SalaryHistoryRecord[];
}

/** How net salaries are bucketed for the histogram below. Fixed,
    round-number bands rather than dynamically computed quantiles — HR
    users read "how many people are in the 50k–80k band" far more
    easily than a computed percentile range, and the bands stay stable
    as more payslips are generated instead of reshuffling every time. */
const BANDS = [
  { label: '<30K', min: 0, max: 30_000 },
  { label: '30–50K', min: 30_000, max: 50_000 },
  { label: '50–80K', min: 50_000, max: 80_000 },
  { label: '80–120K', min: 80_000, max: 120_000 },
  { label: '120K+', min: 120_000, max: Infinity },
];

/** Distribution of the latest net salary per employee (one payslip per
    employee, not one per record — an employee with 6 months of history
    shouldn't count 6x) across fixed pay bands. Sprint 5.6 — purely a
    different view of netSalary values that already exist on the Salary
    History records passed down from App.tsx. */
export function SalaryDistributionPanel({ records }: Props) {
  const latestPerEmployee = useMemo(() => {
    const latest = new Map<string, SalaryHistoryRecord>();
    records.forEach(r => {
      const existing = latest.get(r.employeeId);
      if (!existing || `${r.generatedDate} ${r.generatedTime}` >= `${existing.generatedDate} ${existing.generatedTime}`) {
        latest.set(r.employeeId, r);
      }
    });
    return Array.from(latest.values());
  }, [records]);

  const bands = useMemo(() => BANDS.map(band => ({
    label: band.label,
    value: latestPerEmployee.filter(r => r.netSalary >= band.min && r.netSalary < band.max).length,
  })), [latestPerEmployee]);

  if (latestPerEmployee.length === 0) {
    return (
      <Card title="Salary Distribution" icon={<Coins size={13} />}>
        <EmptyState
          compact
          icon={Coins}
          title="No salary data yet"
          description="Generate salary slips to see how net pay is distributed across your team."
        />
      </Card>
    );
  }

  return (
    <Card title="Salary Distribution" icon={<Coins size={13} />}>
      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', margin: '-4px 0 4px' }}>
        Employees by latest net pay band
      </p>
      <BarChart
        data={bands}
        color="var(--arna-teal)"
        formatValue={n => `${n} employee${n === 1 ? '' : 's'}`}
        height={190}
      />
    </Card>
  );
}
