import React from 'react';
import { QrCode } from 'lucide-react';

interface Props {
  accentColor: string;
}

const sectionLabel: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px',
};
const kvLabel: React.CSSProperties = { fontSize: 9.5, color: '#94A3B8', fontWeight: 600 };
const kvValue: React.CSSProperties = { fontSize: 11, color: '#374151', fontWeight: 600, fontFamily: 'ui-monospace, monospace' };

/** Bank Details / Notes / Signature — Sprint 3 placeholder content
    only. Bank details are static text (not read from anywhere) until
    Company Settings grows a real bank-details section for the
    Finance module to read from; that's explicitly out of scope here. */
export function InvoiceFooter({ accentColor }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <p style={{ ...sectionLabel, color: accentColor }}>Bank Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 14px' }}>
            <span style={kvLabel}>Bank Name</span><span style={kvValue}>Sample Bank Ltd.</span>
            <span style={kvLabel}>Account No.</span><span style={kvValue}>0000 1234 5678</span>
            <span style={kvLabel}>IFSC</span><span style={kvValue}>SAMP0000123</span>
            <span style={kvLabel}>UPI</span><span style={kvValue}>billing@sample</span>
          </div>
          <p style={{ fontSize: 9, color: '#CBD5E1', fontStyle: 'italic', margin: '6px 0 0' }}>
            Placeholder — will come from Company Settings
          </p>
        </div>

        <div style={{
          width: 76, height: 76, flexShrink: 0, borderRadius: 8, border: '1.5px dashed #E2E8F0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          color: '#CBD5E1',
        }}>
          <QrCode size={26} />
          <span style={{ fontSize: 7.5, fontWeight: 600, textAlign: 'center' }}>QR Placeholder</span>
        </div>
      </div>

      <div>
        <p style={{ ...sectionLabel, color: accentColor }}>Notes</p>
        <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Thank you for your business.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', width: 180 }}>
          <div style={{ height: 40, borderBottom: '1.5px solid #E2E8F0', marginBottom: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <span style={{ fontSize: 9.5, color: '#CBD5E1', fontStyle: 'italic', marginBottom: 4 }}>Signature Placeholder</span>
          </div>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Authorized Signature
          </p>
        </div>
      </div>
    </div>
  );
}
