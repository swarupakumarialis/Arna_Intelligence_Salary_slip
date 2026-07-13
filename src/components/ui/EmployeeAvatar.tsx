import React from 'react';

interface Props {
  name: string;
  photoUrl?: string | null;
  size?: number;
}

/** Circular photo avatar with an initials fallback — used anywhere an
    employee's photo placeholder is shown (directory list, directory
    cards, employee form, Salary Generator's employee summary). */
export function EmployeeAvatar({ name, photoUrl, size = 32 }: Props) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: photoUrl ? 'var(--clr-bg)' : 'var(--brand-primary)',
      color: '#fff', border: '1px solid var(--clr-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      fontSize: Math.round(size * 0.36), fontWeight: 700, letterSpacing: '0.02em',
    }}>
      {photoUrl
        ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}
