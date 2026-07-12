import React from 'react';
import { Sparkles } from 'lucide-react';

export interface ComingSoonItem {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  desc: string;
}

interface Props {
  items: ComingSoonItem[];
}

/** Shared "future module" grid — UI-only placeholder cards for
    destinations that don't have a backend yet (Documents, Tax Center,
    and Company Settings' branding placeholders, Sprint 5.7). Every
    card is inert by design (no onClick, muted styling, a "Soon"
    badge) so it reads as a roadmap item, not a broken feature. */
export function ComingSoonGrid({ items }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }} className="stagger-children">
      {items.map(({ icon: Icon, label, desc }) => (
        <div
          key={label}
          className="card animate-fade-in-up"
          style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.85 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div className="kpi-card-icon" style={{ background: 'var(--clr-bg)', color: 'var(--clr-text-muted)', marginBottom: 0 }}>
              <Icon size={17} />
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9.5, fontWeight: 700, color: 'var(--arna-amber)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 999, padding: '2px 8px',
            }}>
              <Sparkles size={10} /> Soon
            </span>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text)', margin: 0 }}>{label}</p>
            <p style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', margin: '3px 0 0' }}>{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
