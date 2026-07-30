import React from 'react';

interface Props {
  show: boolean;
  companyName: string;
  primary: string;
}

/** PDF-layout counterpart of the screen preview's InvoiceWatermark.tsx
    (pt sizing instead of px) — must be placed inside a `position:
    relative` ancestor, see InvoicePdf.tsx. */
export function InvoicePdfWatermark({ show, companyName, primary }: Props) {
  if (!show || !companyName) return null;

  const len = companyName.length;
  const fontSize = len > 45 ? '15pt' : len > 35 ? '18pt' : len > 25 ? '21pt' : len > 15 ? '26pt' : '30pt';

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
