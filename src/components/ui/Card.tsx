import React from 'react';

interface Props {
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyStyle?: React.CSSProperties;
}

/** The `.card` shell (header + body) used all over the app, generalised
    so pages don't hand-roll the same header/title/action markup. */
export function Card({ title, icon, actions, children, className, bodyStyle }: Props) {
  return (
    <div className={`card animate-fade-in-up${className ? ` ${className}` : ''}`}>
      {title && (
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {icon && <span style={{ color: 'var(--clr-accent)', opacity: 0.8, display: 'flex' }}>{icon}</span>}
            {title}
          </span>
          {actions}
        </div>
      )}
      <div className="card-body" style={bodyStyle}>{children}</div>
    </div>
  );
}
