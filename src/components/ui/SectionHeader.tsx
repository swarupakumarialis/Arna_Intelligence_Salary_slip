import React from 'react';

interface Props {
  children: React.ReactNode;
  action?: React.ReactNode;
}

/** Small uppercase label used to divide sections within a page or card
    (e.g. "Quick Actions", "Optional Company Fields", "Display Options"). */
export function SectionHeader({ children, action }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
        {children}
      </p>
      {action}
    </div>
  );
}
