import React, { useState } from 'react';

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}

/** Minimal, dependency-free donut chart — plain SVG circles using the
    stroke-dasharray/stroke-dashoffset technique (no charting library;
    see BarChart.tsx for the same reasoning). Each segment is one
    <circle> stroked for its share of the circumference, rotated -90deg
    so the first segment starts at 12 o'clock like a normal pie/donut. */
export function DonutChart({ data, size = 132, thickness = 18, centerLabel }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const fraction = total > 0 ? d.value / total : 0;
    const segLength = fraction * circumference;
    const offset = cumulative;
    cumulative += segLength;
    return { ...d, segLength, offset, index: i, pct: Math.round(fraction * 100) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--clr-bg)" strokeWidth={thickness} />
          {total > 0 && segments.map(seg => (
            <circle
              key={seg.label}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={hovered === seg.index ? thickness + 3 : thickness}
              strokeDasharray={`${seg.segLength} ${circumference - seg.segLength}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-width 150ms, opacity 150ms', opacity: hovered === null || hovered === seg.index ? 1 : 0.45, cursor: 'default' }}
              onMouseEnter={() => setHovered(seg.index)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {hovered !== null ? segments[hovered].value : total}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {hovered !== null ? segments[hovered].label : (centerLabel || 'Total')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 110 }}>
        {segments.map(seg => (
          <div
            key={seg.label}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'default', opacity: hovered === null || hovered === seg.index ? 1 : 0.55, transition: 'opacity 150ms' }}
            onMouseEnter={() => setHovered(seg.index)}
            onMouseLeave={() => setHovered(null)}
          >
            <span style={{ width: 9, height: 9, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--clr-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ color: 'var(--clr-text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{seg.value} · {seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
