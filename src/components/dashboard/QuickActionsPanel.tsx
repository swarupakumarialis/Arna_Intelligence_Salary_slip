import React from 'react';
import { SectionHeader } from '../ui/SectionHeader';

export interface QuickAction {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  desc: string;
  onClick: () => void;
}

interface Props {
  actions: QuickAction[];
}

/** Grid of shortcut cards into the app's other modules. Presentational
    only — App.tsx/DashboardPage decide what each action does. */
export function QuickActionsPanel({ actions }: Props) {
  return (
    <div>
      <SectionHeader>Quick Actions</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {actions.map(({ icon: Icon, label, desc, onClick }) => (
          <button key={label} className="quick-action-card" onClick={onClick}>
            <div className="quick-action-icon"><Icon size={16} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="quick-action-label">{label}</div>
              <div className="quick-action-desc">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
