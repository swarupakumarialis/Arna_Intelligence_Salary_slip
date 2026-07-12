import React from 'react';

interface Props {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  caption?: string;
  tone?: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
}

const TONE_COLOUR: Record<NonNullable<Props['tone']>, string> = {
  primary: 'var(--arna-navy)',
  success: 'var(--arna-teal)',
  warning: 'var(--arna-amber)',
  info: 'var(--arna-accent)',
  neutral: 'var(--arna-slate)',
};

/** Premium KPI tile for the Dashboard — icon chip in a tone-tinted
    background, large tabular value, optional caption. Distinct from
    the older StatCard (still used by Payroll Export) in layout only;
    both read from the same real, already-computed dashboard metrics. */
export function KpiCard({ icon: Icon, label, value, caption, tone = 'primary' }: Props) {
  const accent = TONE_COLOUR[tone];
  return (
    <div className="kpi-card animate-fade-in-up">
      <div className="kpi-card-icon" style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}>
        <Icon size={17} />
      </div>
      <p className="kpi-card-label">{label}</p>
      <p className="kpi-card-value">{value}</p>
      {caption && <p className="kpi-card-caption">{caption}</p>}
    </div>
  );
}
