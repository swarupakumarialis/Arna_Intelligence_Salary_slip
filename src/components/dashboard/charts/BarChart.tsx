import React, { useState } from 'react';

export interface BarChartDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarChartDatum[];
  color?: string;
  formatValue?: (n: number) => string;
  height?: number;
}

/** Minimal, dependency-free vertical bar chart — plain CSS flex bars
    rather than a charting library, since this is a purely presentational
    Dashboard addition (Sprint 5.6) and the app otherwise has zero chart
    dependencies. Bars animate in via a CSS transition on height (same
    "animate width/height on mount" trick already used by
    .dist-bar-fill elsewhere in the dashboard), and a small tooltip-style
    value bubble appears on hover instead of a full tooltip library. */
export function BarChart({ data, color = 'var(--arna-navy)', formatValue = String, height = 180 }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, padding: '8px 2px 0' }}>
      {data.map((d, i) => {
        const pct = Math.max(2, Math.round((d.value / max) * 100));
        const isHovered = hovered === i;
        return (
          <div
            key={d.label}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHovered && (
              <div
                style={{
                  position: 'absolute', bottom: `calc(${pct}% + 8px)`, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--arna-navy)', color: '#fff', fontSize: 10.5, fontWeight: 700,
                  padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 2,
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {formatValue(d.value)}
              </div>
            )}
            <div
              style={{
                width: '100%', maxWidth: 34, borderRadius: '6px 6px 3px 3px',
                background: isHovered ? color : `color-mix(in srgb, ${color} 82%, white)`,
                height: `${pct}%`, minHeight: 3,
                transition: 'height 0.5s cubic-bezier(0.22, 1, 0.36, 1), background 150ms',
                cursor: 'default',
              }}
            />
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-muted)', marginTop: 7, whiteSpace: 'nowrap' }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
