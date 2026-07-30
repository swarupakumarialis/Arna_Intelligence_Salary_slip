import React from 'react';
import { InvoiceSettings } from '../../utils/invoiceSettingsStore';

interface Props {
  settings: InvoiceSettings;
  accentColor: string;
  generatedDate: string;
  notes: string;
  terms: string;
}

const sectionLabel: React.CSSProperties = {
  fontSize: '6.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1px',
};
const kvLabel: React.CSSProperties = { fontSize: '6pt', color: '#94A3B8', fontWeight: 600 };
const kvValue: React.CSSProperties = { fontSize: '6.5pt', color: '#374151', fontWeight: 600, fontFamily: 'ui-monospace, monospace' };
const placeholderText: React.CSSProperties = { fontSize: '6.5pt', color: '#CBD5E1', fontStyle: 'italic', margin: 0 };

/** Compact PDF footer — PDF-layout counterpart of the screen preview's
    InvoiceFooter.tsx, same 3-column × 2-row grid (Payment Info | Terms
    | Notes, then QR | Signature | Date) — same six pieces of
    information, one row shorter than the previous 2×3 layout, so a
    typical invoice fits comfortably in far less footer height. This
    block is wrapped by InvoicePdf.tsx's own "keep together" container
    so Download PDF's page-slicing (generateInvoicePdf.ts) and Print's
    native pagination both keep it from splitting across pages. */
export function InvoicePdfFooter({ settings, accentColor, generatedDate, notes, terms }: Props) {
  const bankFields: [string, string][] = [
    ['Bank', settings.bankName],
    ['Holder', settings.accountHolder],
    ['A/C No.', settings.accountNumber],
    ['IFSC', settings.ifscCode],
    ['SWIFT', settings.swiftCode],
    ['UPI', settings.upiId],
  ].filter(([, v]) => v.trim()) as [string, string][];

  const displayNotes = notes.trim() || settings.defaultNotes;
  const displayTerms = terms.trim() || settings.defaultTerms;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ height: 1, backgroundColor: '#E2E8F0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', columnGap: 12, rowGap: 2 }}>
        <div>
          <p style={{ ...sectionLabel, color: accentColor }}>Payment Information</p>
          {bankFields.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0px 6px' }}>
              {bankFields.map(([label, value]) => (
                <React.Fragment key={label}>
                  <span style={kvLabel}>{label}</span><span style={kvValue}>{value}</span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p style={placeholderText}>Not configured — add bank details in Invoice Settings.</p>
          )}
        </div>
        <div>
          <p style={{ ...sectionLabel, color: accentColor }}>Terms &amp; Conditions</p>
          <p style={{ fontSize: '6pt', color: '#94A3B8', lineHeight: 1.15, margin: 0 }}>{displayTerms}</p>
        </div>
        <div>
          <p style={{ ...sectionLabel, color: accentColor }}>Notes</p>
          <p style={{ fontSize: '6.5pt', color: '#64748B', margin: 0 }}>{displayNotes}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 18, height: 18, flexShrink: 0, borderRadius: 3,
            border: settings.qrCodeDataUri ? 'none' : '1.5px dashed #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#CBD5E1',
          }}>
            {settings.qrCodeDataUri
              ? <img src={settings.qrCodeDataUri} alt="Payment QR code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: '4pt', fontWeight: 600, textAlign: 'center' }}>QR</span>}
          </div>
          <span style={{ fontSize: '5.5pt', color: '#94A3B8' }}>{settings.qrCodeDataUri ? 'Scan to pay' : 'QR not configured'}</span>
        </div>
        <div>
          <div style={{ height: 10, borderBottom: '1.5px solid #E2E8F0', marginBottom: 1, display: 'flex', alignItems: 'flex-end', maxWidth: 110 }}>
            {settings.signatureImageUri && <img src={settings.signatureImageUri} alt="Signature" style={{ maxHeight: 9, objectFit: 'contain' }} />}
          </div>
          <p style={{ fontSize: '5.5pt', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
            {settings.signatoryName || settings.signatoryTitle || 'Authorized Signature'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <p style={{ fontSize: '5.5pt', color: '#CBD5E1', margin: 0, fontStyle: 'italic' }}>Generated {generatedDate}</p>
        </div>
      </div>
    </div>
  );
}
