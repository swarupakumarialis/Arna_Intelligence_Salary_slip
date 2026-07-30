import React, { useState } from 'react';
import { Save, Loader2, Landmark, FileText, PenLine, Building2, Upload, X } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { Card } from '../../../components/ui/Card';
import { CURRENCY_CODES, CURRENCY_META } from '../../../utils/currencyService';
import { BrandConfig, loadCompanySettings, saveCompanySettings } from '../../../utils/companySettingsStore';
import {
  InvoiceSettings, loadInvoiceSettings, saveInvoiceSettings, sanitizeInvoicePrefix, validateSettingsImageFile,
} from '../utils/invoiceSettingsStore';

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input {...props} className="field" />
      {hint && <p style={{ fontSize: 10.5, color: 'var(--clr-text-subtle)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
}

function TextAreaFieldSmall({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea {...props} className="field" style={{ resize: 'vertical', minHeight: 56, fontFamily: 'inherit' }} />
    </div>
  );
}

function TextAreaField({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea {...props} className="field" style={{ resize: 'vertical', minHeight: 76, fontFamily: 'inherit' }} />
    </div>
  );
}

interface ImageUploadProps {
  label: string;
  imageUri: string | null;
  onChange: (dataUri: string | null) => void;
  onError: (message: string) => void;
}

/** Shared upload control for the QR code / signature images — the one
    place either file is read as a data URI, always through
    validateSettingsImageFile first (Part 5's "validate uploaded
    signature image / QR image"). */
function ImageUpload({ label, imageUri, onChange, onError }: ImageUploadProps) {
  const inputId = `invoice-settings-upload-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const error = validateSettingsImageFile(file);
    if (error) {
      onError(error);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 8, border: '1.5px dashed var(--clr-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
          background: 'var(--clr-bg)',
        }}>
          {imageUri
            ? <img src={imageUri} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <Upload size={18} style={{ color: 'var(--clr-text-subtle)' }} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={inputId} className="btn btn-secondary" style={{ fontSize: 11.5, cursor: 'pointer' }}>
            <Upload size={12} /> {imageUri ? 'Replace' : 'Upload'}
            <input
              id={inputId} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
          {imageUri && (
            <button type="button" onClick={() => onChange(null)} className="btn btn-secondary" style={{ fontSize: 11.5 }}>
              <X size={12} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Finance module — Invoice Settings (Sprint 7, updated). A dedicated,
    localStorage-backed settings store separate from Company Settings'
    BrandConfig (see invoiceSettingsStore.ts) for everything that's
    genuinely Invoice-only (numbering, tax/currency defaults, payment/
    signature details, default notes/terms).
    Company identity (logo/name/address/GST/phone/email) is still
    BrandConfig — the same single source of truth Company Settings and
    the Salary PDF read — but is now editable from here too, saved via
    the same saveCompanySettings() Company Settings itself uses. The
    default value stays whatever DEFAULT_BRAND ships with ("Arnas
    Learning Intelligence Studio Pvt. Ltd."), but any deployment can
    rename it here for their own company without touching code —
    that's the whole point of this being editable rather than
    read-only: a different company can white-label the app to their
    own identity from this one screen. */
export function InvoiceSettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettings>(loadInvoiceSettings);
  const [brand, setBrand] = useState<BrandConfig>(loadCompanySettings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  const patch = (p: Partial<InvoiceSettings>) => setSettings(prev => ({ ...prev, ...p }));
  const patchBrand = (p: Partial<BrandConfig>) => setBrand(prev => ({ ...prev, ...p }));

  const showNotice = (message: string, tone: 'success' | 'error' = 'success') => {
    setNotice(message);
    setNoticeTone(tone);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSave = () => {
    setSaving(true);
    try {
      const sanitized: InvoiceSettings = { ...settings, invoicePrefix: sanitizeInvoicePrefix(settings.invoicePrefix) };
      saveInvoiceSettings(sanitized);
      setSettings(sanitized);
      saveCompanySettings(brand);
      showNotice('Invoice settings saved. New invoices will use these defaults.');
    } catch {
      showNotice('Failed to save invoice settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <Breadcrumb items={[{ label: 'Finance' }, { label: 'Invoice Settings' }]} />
      <PageHeader
        title="Invoice Settings"
        description="Configure numbering, defaults, and payment details that automatically populate new invoices."
      />

      {notice && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: noticeTone === 'success' ? '#F0FDFA' : '#FEF2F2',
          border: `1px solid ${noticeTone === 'success' ? '#99F6E4' : '#FECACA'}`,
          fontSize: 12.5, fontWeight: 600, color: noticeTone === 'success' ? '#0F766E' : '#B91C1C',
        }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
        <Card title="Company Identity" icon={<Building2 size={13} />}>
          <p style={{ fontSize: 11.5, color: 'var(--clr-text-subtle)', margin: '0 0 14px' }}>
            Shown on every invoice (and the Salary payslip) — shared with Company Settings, so editing it here updates it there too.
            Defaults to {`"Arnas Learning Intelligence Studio Pvt. Ltd."`}; rename it for your own company at any time.
          </p>
          <ImageUpload
            label="Company Logo" imageUri={brand.logoDataUri}
            onChange={dataUri => patchBrand({ logoDataUri: dataUri })}
            onError={message => showNotice(message, 'error')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
            <Field label="Company Name" value={brand.companyName} onChange={e => patchBrand({ companyName: e.target.value })} placeholder="Your Company Pvt. Ltd." />
            <Field label="GSTIN" value={brand.gstin || ''} onChange={e => patchBrand({ gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
            <Field label="Phone" value={brand.phone || ''} onChange={e => patchBrand({ phone: e.target.value })} placeholder="+91 98765 43210" />
            <Field label="Email" type="email" value={brand.email || ''} onChange={e => patchBrand({ email: e.target.value })} placeholder="billing@company.com" />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextAreaFieldSmall label="Company Address" value={brand.companyAddress} onChange={e => patchBrand({ companyAddress: e.target.value })} placeholder="Street, City, State - PIN" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, fontWeight: 500, color: 'var(--clr-text)', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={settings.showWatermark}
              onChange={e => patch({ showWatermark: e.target.checked })}
            />
            Show company name as a background watermark on invoices
          </label>
        </Card>

        <Card title="Numbering & Defaults" icon={<FileText size={13} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <Field
              label="Invoice Prefix" value={settings.invoicePrefix}
              onChange={e => patch({ invoicePrefix: e.target.value.toUpperCase() })}
              onBlur={() => patch({ invoicePrefix: sanitizeInvoicePrefix(settings.invoicePrefix) })}
              placeholder="INV" maxLength={6}
              hint={`Example: ${sanitizeInvoicePrefix(settings.invoicePrefix)}-${new Date().getFullYear()}-0001`}
            />
            <Field
              label="Default Tax Percentage" type="number" min={0} max={100} value={settings.defaultTaxPercent}
              onChange={e => patch({ defaultTaxPercent: Number(e.target.value) })}
            />
            <div>
              <label style={labelStyle}>Default Currency</label>
              <select value={settings.defaultCurrency} onChange={e => patch({ defaultCurrency: e.target.value as InvoiceSettings['defaultCurrency'] })} className="field">
                {CURRENCY_CODES.map(code => <option key={code} value={code}>{code} — {CURRENCY_META[code].label}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <Card title="Payment Information" icon={<Landmark size={13} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
            <Field label="Bank Name" value={settings.bankName} onChange={e => patch({ bankName: e.target.value })} placeholder="Sample Bank Ltd." />
            <Field label="Account Holder" value={settings.accountHolder} onChange={e => patch({ accountHolder: e.target.value })} placeholder="Company Legal Name" />
            <Field label="Account Number" value={settings.accountNumber} onChange={e => patch({ accountNumber: e.target.value })} placeholder="0000 1234 5678" />
            <Field label="IFSC Code" value={settings.ifscCode} onChange={e => patch({ ifscCode: e.target.value.toUpperCase() })} placeholder="SAMP0000123" />
            <Field label="SWIFT Code" value={settings.swiftCode} onChange={e => patch({ swiftCode: e.target.value.toUpperCase() })} placeholder="Optional — for international transfers" />
            <Field label="UPI ID" value={settings.upiId} onChange={e => patch({ upiId: e.target.value })} placeholder="billing@upi" />
          </div>
          <ImageUpload
            label="QR Code" imageUri={settings.qrCodeDataUri}
            onChange={dataUri => patch({ qrCodeDataUri: dataUri })}
            onError={message => showNotice(message, 'error')}
          />
        </Card>

        <Card title="Notes & Terms" icon={<FileText size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextAreaField label="Default Notes" value={settings.defaultNotes} onChange={e => patch({ defaultNotes: e.target.value })} />
            <TextAreaField label="Default Terms & Conditions" value={settings.defaultTerms} onChange={e => patch({ defaultTerms: e.target.value })} />
          </div>
        </Card>

        <Card title="Authorized Signature" icon={<PenLine size={13} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
            <Field label="Signatory Name" value={settings.signatoryName} onChange={e => patch({ signatoryName: e.target.value })} placeholder="Jane Doe" />
            <Field label="Signatory Title" value={settings.signatoryTitle} onChange={e => patch({ signatoryTitle: e.target.value })} placeholder="Authorized Signature" />
          </div>
          <ImageUpload
            label="Signature Image" imageUri={settings.signatureImageUri}
            onChange={dataUri => patch({ signatureImageUri: dataUri })}
            onError={message => showNotice(message, 'error')}
          />
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-dark" style={{ fontSize: 12.5 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Invoice Settings
          </button>
        </div>
      </div>
    </div>
  );
}
