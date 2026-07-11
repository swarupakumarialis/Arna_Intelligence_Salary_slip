import React from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Consistent page title + description used at the top of every
    sidebar destination (Dashboard, Salary History, Payroll Export,
    Company Settings). */
export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
