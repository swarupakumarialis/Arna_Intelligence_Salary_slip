import React from 'react';

interface Props {
  show: boolean;
  companyName: string;
  primary: string;
}

/** Company name only, centred, rotated -30deg, at low opacity, spanning
    the invoice behind all content — the screen-preview counterpart of
    src/components/pdf/PDFWatermark.tsx (same visual treatment the
    Salary payslip already uses), reimplemented independently here so
    Invoice's watermark toggle (Invoice Settings' showWatermark) is its
    own setting, not tied to the payslip's showNameWatermark. Font size
    steps down for longer names so the rotated run of text always
    clears the page edges. Must be placed inside a `position: relative`
    ancestor — see InvoicePreview.tsx. */
export function InvoiceWatermark({ show, companyName, primary }: Props) {
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
