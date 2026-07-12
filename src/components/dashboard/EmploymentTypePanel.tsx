import React, { useMemo } from 'react';
import { Employee } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { DonutChart } from './charts/DonutChart';
import { Briefcase } from 'lucide-react';

interface Props {
  employees: Employee[];
}

const TYPE_COLOUR: Record<string, string> = {
  'Full-time': 'var(--arna-navy)',
  'Part-time': 'var(--arna-accent)',
  'Contract': 'var(--arna-teal)',
  'Intern': 'var(--arna-amber)',
  'Unspecified': 'var(--clr-text-subtle)',
};

/** Workforce breakdown by employment type (Sprint 5.6 — split out of
    the old combined EmployeeDistributionPanel so it's its own chart).
    Built entirely from the live Employee Directory; "Unspecified"
    absorbs any record with no employmentType set rather than being
    silently dropped, so the total always reconciles with the
    directory's real headcount. */
export function EmploymentTypePanel({ employees }: Props) {
  const total = employees.length;

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach(e => {
      const key = e.employmentType || 'Unspecified';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({ label: type, value: count, color: TYPE_COLOUR[type] || 'var(--brand-primary)' }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  if (total === 0) {
    return (
      <Card title="Employment Type" icon={<Briefcase size={13} />}>
        <EmptyState
          compact
          icon={Briefcase}
          title="No employees yet"
          description="Add employees to the directory to see the employment-type breakdown here."
        />
      </Card>
    );
  }

  return (
    <Card title="Employment Type" icon={<Briefcase size={13} />}>
      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', margin: '-4px 0 16px' }}>
        Full-time, part-time, contract & intern headcount
      </p>
      <DonutChart data={byType} centerLabel="Total" />
    </Card>
  );
}
