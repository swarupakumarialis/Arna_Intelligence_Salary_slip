import React from 'react';

export type BadgeTone = 'success' | 'neutral' | 'info' | 'warning' | 'danger';

/* Every tone is derived from the ARNA design tokens already defined in
   index.css (--arna-teal / --arna-amber / --brand-primary / --clr-danger)
   — no new colours are introduced here. */
const TONE_STYLE: Record<BadgeTone, React.CSSProperties> = {
  success: { background: '#F0FDFA', color: 'var(--arna-teal)', borderColor: '#99F6E4' },
  neutral: { background: '#F1F5F9', color: 'var(--clr-text-muted)', borderColor: 'var(--clr-border)' },
  info:    { background: '#F0FDFA', color: 'var(--brand-primary)', borderColor: 'var(--arna-mint)' },
  warning: { background: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' },
  danger:  { background: 'var(--clr-danger-soft)', color: 'var(--clr-danger)', borderColor: '#FECACA' },
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return (
    <span className="badge" style={{ ...TONE_STYLE[tone], flexShrink: 0 }}>
      {label}
    </span>
  );
}
