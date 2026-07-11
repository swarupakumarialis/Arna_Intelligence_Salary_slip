import React from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  /** Optional pointer to where a related, already-working feature lives today. */
  note?: string;
}

/**
 * Honest placeholder for sidebar destinations that don't have a real
 * screen behind them yet (Dashboard, Salary History, Payroll Export,
 * Company Settings). Keeps the navigation feeling complete without
 * inventing data or functionality that isn't there.
 */
export function ComingSoon({ icon: Icon, title, description, note }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon size={24} /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      {note && (
        <p style={{ color: 'var(--clr-text-subtle)', fontSize: 12 }}>{note}</p>
      )}
      <span className="empty-state-badge"><Sparkles size={12} /> Coming in a future sprint</span>
    </div>
  );
}
