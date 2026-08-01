import React from 'react';
import { QrCode } from 'lucide-react';
import { InvoiceSettings, maskAccountNumber } from '../../utils/invoiceSettingsStore';

interface Props {
  settings: InvoiceSettings;
  accentColor: string;
  /** This invoice's own notes/terms (falls back to the live Invoice
      Settings default when empty — e.g. an invoice created before
      Sprint 7 has no termsAndConditions of its own). */
  notes: string;
  terms: string;
}

const sectionLabel: React.CSSProperties = {
  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1px',
};
const kvLabel: React.CSSProperties = { fontSize: 8.5, color: '#94A3B8', fontWeight: 600 };
const kvValue: React.CSSProperties = { fontSize: 9, color: '#374151', fontWeight: 600, fontFamily: 'ui-monospace, monospace' };
const placeholderText: React.CSSProperties = { fontSize: 8.5, color: '#CBD5E1', fontStyle: 'italic', margin: 0 };

/** Compact footer — the old layout stacked Payment Information / QR /
    Notes / Terms / Signature vertically, one after another, eating a
    third of the page even on a short invoice. This is a 3-column ×
    2-row grid (Payment Info | Terms | Notes, then QR | Signature |
    Date) — same six pieces of information as the previous 2×3 grid,
    just one row shorter, which cuts a further ~30% of footer height
    without shrinking type below a readable size or dropping anything.
    Bank/QR/signature come from Invoice Settings — see
    modules/finance/utils/invoiceSettingsStore.ts. */
export function InvoiceFooter({ settings, accentColor, notes, terms }: Props) {
  const bankFields: [string, string][] = [
    ['Bank', settings.bankName],
    ['Holder', settings.accountHolder],
    ['A/C No.', maskAccountNumber(settings.accountNumber)],
    ['IFSC', settings.ifscCode],
    ['SWIFT', settings.swiftCode],
    ['UPI', settings.upiId],
  ].filter(([, v]) => v.trim()) as [string, string][];

  const displayNotes = notes.trim() || settings.defaultNotes;
  const displayTerms = terms.trim() || settings.defaultTerms;
  const hasSignatureImage = !!settings.signatureImageUri;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: 1, background: '#E2E8F0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', columnGap: 16, rowGap: 3 }}>
        <div>
          <p style={{ ...sectionLabel, color: accentColor }}>Payment Information</p>
          {bankFields.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0px 8px' }}>
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
          <p style={{ fontSize: 8, color: '#94A3B8', lineHeight: 1.2, margin: 0 }}>{displayTerms}</p>
        </div>
        <div>
          <p style={{ ...sectionLabel, color: accentColor }}>Notes</p>
          <p style={{ fontSize: 8.5, color: '#64748B', margin: 0 }}>{displayNotes}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 26, height: 26, flexShrink: 0, borderRadius: 4,
            border: hasSignatureImage ? 'none' : '1.5px dashed #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#CBD5E1',
          }}>
            {settings.qrCodeDataUri
              ? <img src={settings.qrCodeDataUri} alt="Payment QR code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <QrCode size={11} />}
          </div>
          <span style={{ fontSize: 7.5, color: '#94A3B8' }}>{settings.qrCodeDataUri ? 'Scan to pay' : 'QR not configured'}</span>
        </div>
        <div>
          <div style={{ height: 13, borderBottom: '1.5px solid #E2E8F0', marginBottom: 1, display: 'flex', alignItems: 'flex-end', maxWidth: 120 }}>
            {settings.signatureImageUri && <img src={settings.signatureImageUri} alt="Signature" style={{ maxHeight: 12, objectFit: 'contain' }} />}
          </div>
          <p style={{ fontSize: 7.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
            {settings.signatoryName || settings.signatoryTitle || 'Authorized Signature'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <p style={{ fontSize: 7.5, color: '#CBD5E1', margin: 0, fontStyle: 'italic' }}>
            Generated {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
