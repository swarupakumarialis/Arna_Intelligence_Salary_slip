import React, { useMemo } from 'react';
import { Employee } from '../../types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Users } from 'lucide-react';

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

/** Workforce breakdown by employment type, built entirely from the
    live Employee Directory (App.tsx's `employees` state) — no
    invented categories or counts. "Unspecified" absorbs any record
    with no employmentType set rather than being silently dropped, so
    the total always reconciles with the directory's real headcount. */
export function EmployeeDistributionPanel({ employees }: Props) {
  const total = employees.length;
  const activeCount = useMemo(() => employees.filter(e => e.status === 'Active').length, [employees]);

  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach(e => {
      const key = e.employmentType || 'Unspecified';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count, pct: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
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
      <div style={{ display: 'flex', gap: 24, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums' }}>{total}</div>
          <div style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>Total</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--arna-teal)', fontVariantNumeric: 'tabular-nums' }}>{activeCount}</div>
          <div style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>Active</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--clr-text-subtle)', fontVariantNumeric: 'tabular-nums' }}>{total - activeCount}</div>
          <div style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>Inactive</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {byType.map(({ type, count, pct }) => (
          <div key={type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--clr-text)' }}>{type}</span>
              <span style={{ color: 'var(--clr-text-muted)' }}>{count} · {pct}%</span>
            </div>
            <div className="dist-bar-track">
              <div className="dist-bar-fill" style={{ width: `${pct}%`, background: TYPE_COLOUR[type] || 'var(--brand-primary)' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
