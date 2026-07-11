import React from 'react';

interface Props {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  caption?: string;
}

/** Dashboard / Payroll Export summary tile — brand-primary icon chip,
    white card, soft shadow, subtle hover lift (see .stat-card in index.css). */
export function StatCard({ icon: Icon, label, value, caption }: Props) {
  return (
    <div className="stat-card">
      <div style={{ minWidth: 0 }}>
        <p className="stat-card-label">{label}</p>
        <p className="stat-card-value">{value}</p>
        {caption && <p className="stat-card-caption">{caption}</p>}
      </div>
      <div className="stat-card-icon"><Icon size={15} /></div>
    </div>
  );
}
