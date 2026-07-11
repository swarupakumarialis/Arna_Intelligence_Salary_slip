import React from 'react';

interface Props {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Trims padding/shadow for use inside a Card rather than as a
      full-page state (see .empty-state-compact in index.css). */
  compact?: boolean;
}

/** Generic empty state — formalises the pattern already used ad hoc by
    Salary History and Company Settings, so new panels (Payroll
    Summary, Employee Distribution, Recent Activity) get the same
    professional "nothing here yet" treatment for free. */
export function EmptyState({ icon: Icon, title, description, action, compact }: Props) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      <div className="empty-state-icon"><Icon size={compact ? 18 : 24} /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
