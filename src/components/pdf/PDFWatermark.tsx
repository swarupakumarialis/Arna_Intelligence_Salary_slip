import React from 'react';

interface Props {
  show: boolean;
  companyName: string;
  primary: string;
}

/**
 * Company name only (no logo), centred, rotated -30deg, at low opacity,
 * spanning the full page behind all content. Font size steps down for
 * longer names so the rotated run of text always stays clear of the
 * page edges instead of crowding or overhanging them. Reads directly
 * from the same `brand.companyName` value the rest of the document
 * uses, so it updates automatically the moment it changes in Company
 * Settings — there's no separate state to keep in sync.
 */
export function PDFWatermark({ show, companyName, primary }: Props) {
  if (!show || !companyName) return null;

  const len = companyName.length;
  const fontSize = len > 45 ? 20 : len > 35 ? 24 : len > 25 ? 28 : len > 15 ? 34 : 40;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', userSelect: 'none', overflow: 'hidden',
    }}>
      <div style={{
        transform: 'rotate(-30deg)',
        fontSize, fontWeight: 800, color: primary,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        whiteSpace: 'nowrap', lineHeight: 1,
        opacity: 0.06,
      }}>
        {companyName}
      </div>
    </div>
  );
}
