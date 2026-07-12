import React, { useMemo } from 'react';
import { Employee } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { DonutChart } from './charts/DonutChart';
import { Users } from 'lucide-react';

interface Props {
  employees: Employee[];
}

/** Active vs. inactive headcount, built entirely from the live
    Employee Directory (App.tsx's `employees` state) — no invented
    categories or counts. Employment-type breakdown moved to its own
    EmploymentTypePanel (Sprint 5.6) so each donut answers one question. */
export function EmployeeDistributionPanel({ employees }: Props) {
  const total = employees.length;

  const segments = useMemo(() => {
    const active = employees.filter(e => e.status === 'Active').length;
    return [
      { label: 'Active', value: active, color: 'var(--arna-teal)' },
      { label: 'Inactive', value: total - active, color: 'var(--clr-text-subtle)' },
    ].filter(s => s.value > 0);
  }, [employees, total]);

  if (total === 0) {
    return (
      <Card title="Employee Distribution" icon={<Users size={13} />}>
        <EmptyState
          compact
          icon={Users}
          title="No employees yet"
          description="Add employees to the directory to see the workforce breakdown here."
        />
      </Card>
    );
  }

  return (
    <Card title="Employee Distribution" icon={<Users size={13} />}>
      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', margin: '-4px 0 16px' }}>
        {total} employee{total === 1 ? '' : 's'} in the directory
      </p>
      <DonutChart data={segments} centerLabel="Total" />
    </Card>
  );
}
