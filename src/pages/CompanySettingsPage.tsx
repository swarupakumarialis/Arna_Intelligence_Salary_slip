import React, { useEffect, useState } from 'react';
import { BrandConfig, DEFAULT_BRAND } from '../utils/companySettingsStore';
import { FormErrors, TouchedFields } from '../App';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Sparkles, Building2, Palette, Phone, Wallet, FileText, ToggleLeft, Upload, X, Coins, Contrast, Zap, Clock, Cloud, CheckCircle2, XCircle, RefreshCw, Save } from 'lucide-react';
import { CurrencyCode, CURRENCY_META, CURRENCY_CODES } from '../contexts/CurrencyContext';
import {
  getGoogleDriveStatus, connectGoogleDrive, disconnectGoogleDrive, testGoogleDriveConnection, getGoogleDriveStorageStats,
  GoogleDriveStatus, GoogleDriveStorageStats, ApiError as GoogleDriveApiError,
} from '../api/googleDriveApi';

interface Props {
  brand: BrandConfig;
  onBrandChange: (b: BrandConfig) => void;
  onResetBrand: () => void;
  errors: FormErrors;
  touched: TouchedFields;
  onBlurField: (field: keyof Omit<FormErrors, 'deductions'>) => void;
  /** Fired once per actual Save click, only if something changed. */
  onSettingsChanged: () => void;
  /** Fires whenever "does this page have edits that haven't been saved
      yet" flips — App.tsx uses this the same way it uses
      InvoiceGeneratorPage/InvoiceSettingsPage's onDirtyChange, to warn
      before switching the sidebar away from a page with unsaved work.
      This page used to auto-save every keystroke, so there was never
      anything to lose by navigating away; now that each section has its
      own explicit Save button, an edit sitting in the draft below is
      real unsaved work until Save is clicked. */
  onDirtyChange?: (dirty: boolean) => void;
}

type TabKey = 'brand' | 'company' | 'currency' | 'display' | 'pdf' | 'google-drive' | 'advanced';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'brand', label: 'Brand', icon: Palette },
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'currency', label: 'Currency', icon: Coins },
  { key: 'display', label: 'Display', icon: ToggleLeft },
  { key: 'pdf', label: 'PDF', icon: FileText },
  { key: 'google-drive', label: 'Google Drive', icon: Cloud },
  { key: 'advanced', label: 'Advanced', icon: Wallet },
];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="field-label">
      {children}
      {required && <span style={{ color: 'var(--clr-danger)', marginLeft: 3, fontWeight: 700 }}>*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ fontSize: 11, color: 'var(--clr-danger)', marginTop: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--clr-danger)', flexShrink: 0, display: 'inline-block' }} />
      {message}
    </div>
  );
}

function InlineInput({
  label: lbl, required, error, ...props
}: { label: string; required?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel required={required}>{lbl}</FieldLabel>
      <input
        {...props}
        className="field"
        style={{ ...(props.style || {}), borderColor: error ? '#FCA5A5' : undefined, boxShadow: error ? '0 0 0 3px rgba(220,38,38,0.10)' : undefined }}
      />
      <FieldError message={error} />
    </div>
  );
}

function InlineTextarea({
  label: lbl, required, error, ...props
}: { label: string; required?: boolean; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <FieldLabel required={required}>{lbl}</FieldLabel>
      <textarea
        {...props}
        className="field"
        style={{ ...(props.style || {}), borderColor: error ? '#FCA5A5' : undefined, boxShadow: error ? '0 0 0 3px rgba(220,38,38,0.10)' : undefined }}
      />
      <FieldError message={error} />
    </div>
  );
}

/** One "Save [Section]" button, repeated at the bottom of every tab that
    has editable fields (Brand, Company, Currency, Display, PDF) — the
    literal ask behind this page's draft/Save split: "each section
    should have a save option". `dirty` is shared across every instance
    (see isDirty below) since every tab edits the same underlying
    BrandConfig object — saving from any one of them persists all
    pending edits, not just that tab's own fields. */
function SaveBar({ dirty, onSave, label }: { dirty: boolean; onSave: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 }}>
      {dirty && <span style={{ fontSize: 11, color: 'var(--clr-text-subtle)', fontStyle: 'italic' }}>Unsaved changes</span>}
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty}
        className="btn btn-dark"
        style={{ fontSize: 12.5, opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'default' }}
      >
        <Save size={13} /> {label}
      </button>
    </div>
  );
}

const DISPLAY_TOGGLES: { key: keyof BrandConfig; label: string }[] = [
  { key: 'showLogo', label: 'Show Company Logo' },
  { key: 'showCompanyName', label: 'Show Company Name' },
  { key: 'showCompanyAddress', label: 'Show Company Address' },
  { key: 'showGstin', label: 'Show GSTIN' },
  { key: 'showPan', label: 'Show PAN' },
  { key: 'showWebsite', label: 'Show Website' },
  { key: 'showEmail', label: 'Show Email' },
  { key: 'showPhone', label: 'Show Phone Number' },
  { key: 'showBankDetails', label: 'Show Bank Details on Payslip' },
  { key: 'showNameWatermark', label: 'Show Name Watermark' },
  { key: 'showSignatory', label: 'Show Authorised Signatory' },
  { key: 'showPoweredBy', label: 'Show "Powered by ARNA"' },
  { key: 'showGeneratedDate', label: 'Show Generated Date' },
  { key: 'showGeneratedTime', label: 'Show Generated Time' },
];

/**
 * White-label configuration for the whole application, organised into
 * tabs by category. Every field reads from / writes through a local
 * `draft` copy of the same BrandConfig object that drives the Live
 * Preview, the exported PDF, and (via --brand-primary/--brand-secondary)
 * the app's own nav chrome — edits only become live once a section's
 * Save button is clicked (see SaveBar above), rather than the old
 * auto-save-on-every-keystroke behaviour, so a half-finished edit never
 * silently applies everywhere before it's ready.
 */
export function CompanySettingsPage({ brand, onBrandChange, onResetBrand, errors, touched, onBlurField, onSettingsChanged, onDirtyChange }: Props) {
  const [tab, setTab] = useState<TabKey>('brand');

  /* Local draft — the one thing every field in this page actually reads
     from / writes to. Seeded once from the live `brand` prop on mount;
     this page (like InvoiceGeneratorPage/InvoiceSettingsPage) owns its
     own self-contained form state rather than reactively resyncing from
     the prop afterwards, so an in-progress edit here is never clobbered
     by an unrelated external brand change. */
  const [draft, setDraft] = useState<BrandConfig>(brand);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(brand);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);
  useEffect(() => () => { onDirtyChange?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<BrandConfig>) => setDraft(prev => ({ ...prev, ...p }));

  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  /** Shared by every tab's SaveBar — persists the current draft (all of
      it, not just the fields visible on the tab that was clicked, since
      it's one underlying object) via onBrandChange, stamps
      exchangeRateUpdatedAt only when the rates actually changed, then
      reports one activity-log entry and a confirmation pop-up. */
  const handleSave = (label: string) => {
    const rateChanged = JSON.stringify(draft.exchangeRates) !== JSON.stringify(brand.exchangeRates);
    const toSave = rateChanged ? { ...draft, exchangeRateUpdatedAt: new Date().toISOString() } : draft;
    onBrandChange(toSave);
    setDraft(toSave);
    onSettingsChanged();
    showNotice(`${label} saved.`);
  };

  const handleReset = () => {
    onResetBrand();
    setDraft(DEFAULT_BRAND);
  };

  /* Google Drive connection (Sprint 6.2A). Status is fetched fresh on
     mount rather than kept in App.tsx's shared state — this is the
     only place in the app that needs it. Entirely separate from
     BrandConfig/draft above — every action here (connect/disconnect/
     test) is immediate, not something to stage and save. */
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveActionPending, setDriveActionPending] = useState<'connect' | 'disconnect' | 'test' | null>(null);
  const [driveNotice, setDriveNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [driveStats, setDriveStats] = useState<GoogleDriveStorageStats | null>(null);
  const [driveStatsLoading, setDriveStatsLoading] = useState(false);

  const refreshDriveStatus = () => {
    setDriveLoading(true);
    getGoogleDriveStatus()
      .then(status => {
        setDriveStatus(status);
        if (status.connected) {
          setDriveStatsLoading(true);
          getGoogleDriveStorageStats()
            .then(setDriveStats)
            .catch(() => setDriveStats(null))
            .finally(() => setDriveStatsLoading(false));
        } else {
          setDriveStats(null);
        }
      })
      .catch(() => setDriveStatus({ connected: false }))
      .finally(() => setDriveLoading(false));
  };

  function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  /* Reads the `?drive=connected` / `?drive=error&reason=...` query
     param the backend's OAuth callback redirects back with (see
     App.tsx, which switches to this page when it sees that param),
     shows a one-time notice, opens this tab, then strips the param so
     a refresh doesn't re-show it. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drive = params.get('drive');
    if (drive === 'connected') {
      setTab('google-drive');
      setDriveNotice({ kind: 'success', message: 'Google Drive connected successfully.' });
    } else if (drive === 'error') {
      setTab('google-drive');
      setDriveNotice({ kind: 'error', message: `Google Drive connection failed: ${params.get('reason') || 'unknown error'}` });
    }
    if (drive) {
      params.delete('drive');
      params.delete('reason');
      const rest = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    refreshDriveStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectDrive = async () => {
    setDriveActionPending('connect');
    try {
      await connectGoogleDrive(); // navigates away to Google's consent screen
    } catch (err) {
      setDriveNotice({ kind: 'error', message: err instanceof GoogleDriveApiError ? err.message : 'Unable to start Google Drive connection' });
      setDriveActionPending(null);
    }
  };

  const handleDisconnectDrive = async () => {
    setDriveActionPending('disconnect');
    try {
      await disconnectGoogleDrive();
      setDriveNotice({ kind: 'success', message: 'Google Drive disconnected.' });
      refreshDriveStatus();
    } catch (err) {
      setDriveNotice({ kind: 'error', message: err instanceof GoogleDriveApiError ? err.message : 'Failed to disconnect Google Drive' });
    } finally {
      setDriveActionPending(null);
    }
  };

  const handleTestDrive = async () => {
    setDriveActionPending('test');
    try {
      const result = await testGoogleDriveConnection();
      setDriveNotice({ kind: 'success', message: `Connection healthy (${result.user || 'verified'}).` });
      refreshDriveStatus();
    } catch (err) {
      setDriveNotice({ kind: 'error', message: err instanceof GoogleDriveApiError ? err.message : 'Connection test failed' });
    } finally {
      setDriveActionPending(null);
    }
  };

  const err = (field: keyof Omit<FormErrors, 'deductions'>) =>
    touched[field] ? errors[field] : undefined;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => patch({ logoDataUri: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Company Settings"
        description="Logo, identity, branding, and PDF details — edit any section below, then click its Save button to apply the changes."
        actions={
          <button
            onClick={handleReset}
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
          >
            Reset to Default
          </button>
        }
      />

      {/* Fixed top pop-up — same placement as the Invoice module's own
          save confirmations, clear of the sticky 80px header. */}
      {notice && (
        <div style={{
          position: 'fixed', top: 96, right: 24, zIndex: 10001,
          maxWidth: 360, padding: '12px 16px', borderRadius: 10,
          background: '#0F766E', color: '#fff', fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 12px 32px rgba(15,23,42,0.28)',
        }}>
          {notice}
        </div>
      )}

      <div className="tabs-row">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab-item${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'brand' && (
        <Card title="Brand">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div>
              <FieldLabel>Company Logo</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {draft.logoDataUri && (
                  <div style={{ position: 'relative' }}>
                    <img src={draft.logoDataUri} alt="Company logo" style={{ height: 44, width: 'auto', maxWidth: 90, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--clr-border)', padding: 4 }} />
                    <button
                      onClick={() => patch({ logoDataUri: null })}
                      title="Remove logo"
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#374151', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1.5px dashed var(--clr-border)', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                  <Upload size={13} />
                  {draft.logoDataUri ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                </label>
              </div>
            </div>
            <div />
            <div>
              <FieldLabel>Primary Brand Colour</FieldLabel>
              <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', margin: '0 0 8px' }}>Header, buttons, table headers, net pay card.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={draft.primaryColour} onChange={e => patch({ primaryColour: e.target.value })}
                  style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: '1.5px solid var(--clr-border)', cursor: 'pointer', background: 'none' }} />
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--clr-text-muted)', fontWeight: 600 }}>{draft.primaryColour}</span>
              </div>
            </div>
            <div>
              <FieldLabel>Secondary Brand Colour</FieldLabel>
              <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', margin: '0 0 8px' }}>Accent lines, icons, highlights, card borders.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={draft.secondaryColour} onChange={e => patch({ secondaryColour: e.target.value })}
                  style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: '1.5px solid var(--clr-border)', cursor: 'pointer', background: 'none' }} />
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--clr-text-muted)', fontWeight: 600 }}>{draft.secondaryColour}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'brand' && (
        <Card title="More Branding Options" icon={<Contrast size={13} />} className="animate-fade-in-up" bodyStyle={{ opacity: 0.85 }}>
          <p style={{ fontSize: 11.5, color: 'var(--clr-text-subtle)', margin: '-4px 0 16px' }}>
            Additional branding controls, on top of the working Logo and Colours above.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {[
              { label: 'Accent Colour', desc: 'A third colour for badges, chips, and secondary highlights.' },
              { label: 'Theme', desc: 'Light / dark mode for the app itself (payslips stay print-ready white).' },
            ].map(({ label, desc }) => (
              <div key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <FieldLabel>{label}</FieldLabel>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: 9.5, fontWeight: 700, color: 'var(--arna-amber)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: '#FFFBEB', border: '1px solid #FDE68A',
                    borderRadius: 999, padding: '1px 7px', marginBottom: 5,
                  }}>
                    <Sparkles size={9} /> Available in Upcoming Release
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'brand' && <SaveBar dirty={isDirty} onSave={() => handleSave('Brand settings')} label="Save Brand Settings" />}

      {tab === 'company' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Company Identity">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <InlineInput
                label="Company Name" type="text" name="companyName" required
                value={draft.companyName}
                onChange={e => patch({ companyName: e.target.value })}
                onBlur={() => onBlurField('companyName')}
                placeholder="Acme Corporation"
                error={err('companyName')}
              />
              <div />
              <InlineTextarea
                label="Company Address" name="companyAddress" required
                value={draft.companyAddress}
                onChange={e => patch({ companyAddress: e.target.value })}
                onBlur={() => onBlurField('companyAddress')}
                rows={4} style={{ resize: 'none' }} placeholder="Full address..."
                error={err('companyAddress')}
              />
            </div>
          </Card>

          <Card title="Contact Details" icon={<Phone size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <InlineInput label="GSTIN" type="text" name="gstin" value={draft.gstin || ''} onChange={e => patch({ gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
              <InlineInput label="PAN" type="text" name="pan" value={draft.pan || ''} onChange={e => patch({ pan: e.target.value })} placeholder="AAAPL1234C" />
              <InlineInput label="Phone" type="text" name="phone" value={draft.phone || ''} onChange={e => patch({ phone: e.target.value })} placeholder="+91 98765 43210" />
              <InlineInput label="Email" type="text" name="email" value={draft.email || ''} onChange={e => patch({ email: e.target.value })} placeholder="hr@company.com" />
              <div style={{ gridColumn: '1 / -1' }}>
                <InlineInput label="Website" type="text" name="website" value={draft.website || ''} onChange={e => patch({ website: e.target.value })} placeholder="www.company.com" />
              </div>
            </div>
          </Card>

          <Card title="Bank Details" icon={<Wallet size={13} />}>
            <p style={{ fontSize: 11.5, color: 'var(--clr-text-subtle)', margin: '0 0 14px' }}>
              Shown on every Salary Slip (screen and PDF), next to "Amount in Words" — the same way the Invoice module
              shows its own bank details on an invoice. The account number is always masked there; only the last 4
              digits are shown. Toggle visibility under Display Options.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <InlineInput label="Bank Name" type="text" value={draft.bankName || ''} onChange={e => patch({ bankName: e.target.value })} placeholder="HDFC Bank" />
              <InlineInput label="Account Holder" type="text" value={draft.bankAccountHolder || ''} onChange={e => patch({ bankAccountHolder: e.target.value })} placeholder="Company Legal Name" />
              <InlineInput
                label="Account Number" type="text" value={draft.bankAccountNumber || ''}
                onChange={e => patch({ bankAccountNumber: e.target.value })}
                placeholder="0000 1234 5678"
              />
              <InlineInput label="IFSC Code" type="text" value={draft.bankIfscCode || ''} onChange={e => patch({ bankIfscCode: e.target.value.toUpperCase() })} placeholder="HDFC0001234" />
              <InlineInput label="SWIFT Code" type="text" value={draft.bankSwiftCode || ''} onChange={e => patch({ bankSwiftCode: e.target.value.toUpperCase() })} placeholder="Optional — for international transfers" />
              <InlineInput label="UPI ID" type="text" value={draft.bankUpiId || ''} onChange={e => patch({ bankUpiId: e.target.value })} placeholder="billing@upi" />
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--clr-text-subtle)', margin: '8px 0 0' }}>
              Masked on the Salary Slip — employees only see the last 4 digits.
            </p>
          </Card>

          <SaveBar dirty={isDirty} onSave={() => handleSave('Company details')} label="Save Company Details" />
        </div>
      )}

      {tab === 'currency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Currency Settings" icon={<Coins size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div>
                <FieldLabel>Default Currency</FieldLabel>
                <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', margin: '0 0 8px' }}>
                  What the whole app displays by default — Dashboard, Salary Generator, Salary History, Payroll Summary, the Live Preview, and the exported PDF.
                </p>
                <select
                  className="field"
                  value={draft.defaultCurrency || 'INR'}
                  onChange={e => patch({ defaultCurrency: e.target.value as CurrencyCode })}
                >
                  {CURRENCY_CODES.map(c => (
                    <option key={c} value={c}>{CURRENCY_META[c].symbol} {c} — {CURRENCY_META[c].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Base Currency</FieldLabel>
                <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', margin: '0 0 8px' }}>
                  What payroll is actually calculated and stored in. Every other currency's exchange rate below is quoted against this one.
                </p>
                <select
                  className="field"
                  value={draft.baseCurrency || 'INR'}
                  onChange={e => patch({ baseCurrency: e.target.value as CurrencyCode })}
                >
                  {CURRENCY_CODES.map(c => (
                    <option key={c} value={c}>{CURRENCY_META[c].symbol} {c} — {CURRENCY_META[c].label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <FieldLabel>Exchange Rates</FieldLabel>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 10.5, fontWeight: 700, color: 'var(--arna-slate)',
                  background: 'var(--clr-bg)', border: '1px solid var(--clr-border)',
                  borderRadius: 999, padding: '3px 9px',
                }}>
                  <Clock size={10} />
                  Last updated {brand.exchangeRateUpdatedAt
                    ? new Date(brand.exchangeRateUpdatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'never'}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', margin: '0 0 14px' }}>
                Rates are entered manually today, one per currency, quoted against the base currency above (e.g. 1 USD = 96 {draft.baseCurrency || 'INR'}). Payroll amounts are never rewritten — only how they're displayed changes.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {CURRENCY_CODES.filter(c => c !== (draft.baseCurrency || 'INR')).map(code => (
                  <div key={code}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--clr-text-muted)', display: 'block', marginBottom: 5 }}>
                      {CURRENCY_META[code].symbol} {code} — {CURRENCY_META[code].label}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 12, color: 'var(--clr-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>1 {code} =</span>
                      <input
                        type="number"
                        className="field"
                        min={0.0001}
                        step="0.01"
                        value={draft.exchangeRates?.[code] ?? ''}
                        placeholder="e.g. 96"
                        onChange={e => {
                          const value = Number(e.target.value);
                          patch({ exchangeRates: { ...draft.exchangeRates, [code]: value > 0 ? value : undefined } });
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--clr-text-muted)', fontWeight: 600 }}>{draft.baseCurrency || 'INR'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Future Integration" icon={<Zap size={13} />} bodyStyle={{ opacity: 0.9 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, marginTop: 1,
                fontSize: 9.5, fontWeight: 700, color: 'var(--arna-amber)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 999, padding: '2px 8px',
              }}>
                <Sparkles size={9} /> Manual Today
              </span>
              <p style={{ fontSize: 11.5, color: 'var(--clr-text-subtle)', margin: 0, lineHeight: 1.6 }}>
                Exchange rates are entered by hand above. A future release can fetch live rates from an exchange-rate API automatically —
                the app is already built for this: every screen reads rates through one shared currency service, so switching to a live
                feed later only means changing where that one service gets its numbers from, not any individual page.
              </p>
            </div>
          </Card>

          <SaveBar dirty={isDirty} onSave={() => handleSave('Currency settings')} label="Save Currency Settings" />
        </div>
      )}

      {tab === 'advanced' && (
        <Card title="Advanced">
          <div className="empty-state" style={{ padding: '40px 24px' }}>
            <div className="empty-state-icon"><Wallet size={22} /></div>
            <h2>Not yet configurable</h2>
            <p>Defaults like standard working days will live here once payroll defaults are introduced — today, Working Days and LOP are set per payslip in the Salary Generator. (Default currency now lives under the Currency tab.)</p>
            <span className="empty-state-badge"><Sparkles size={12} /> Coming in a future sprint</span>
          </div>
        </Card>
      )}

      {tab === 'pdf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="PDF Settings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {draft.showSignatory ? (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Authorised Signatory</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <InlineInput label="Signatory Name" type="text" value={draft.signatoryName || ''}
                      onChange={e => patch({ signatoryName: e.target.value })} placeholder="e.g. Rajesh Kumar" />
                    <InlineInput label="Signatory Title" type="text" value={draft.signatoryTitle || 'Authorised Signatory'}
                      onChange={e => patch({ signatoryTitle: e.target.value })} placeholder="Authorised Signatory" />
                  </div>
                  <FieldLabel>Signature Image (optional)</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {draft.signatoryImageUri && (
                      <div style={{ position: 'relative' }}>
                        <img src={draft.signatoryImageUri} alt="Signature" style={{ height: 36, width: 'auto', maxWidth: 120, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--clr-border)', padding: 3, background: '#fff' }} />
                        <button onClick={() => patch({ signatoryImageUri: null })} title="Remove signature"
                          style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#374151', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <X size={8} />
                        </button>
                      </div>
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', border: '1.5px dashed var(--clr-border)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                      <Upload size={11} />
                      {draft.signatoryImageUri ? 'Change' : 'Upload Signature'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => patch({ signatoryImageUri: reader.result as string });
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)' }}>
                  Enable "Show Authorised Signatory" under Display Options to set a signatory name, title, and signature image.
                </p>
              )}

              <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Company Watermark</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--clr-text)', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={!!draft.showNameWatermark}
                    onChange={e => patch({ showNameWatermark: e.target.checked })}
                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: draft.primaryColour }}
                  />
                  Show a faint company name watermark across the payslip
                </label>
              </div>
            </div>
          </Card>

          <SaveBar dirty={isDirty} onSave={() => handleSave('PDF settings')} label="Save PDF Settings" />
        </div>
      )}

      {tab === 'google-drive' && (
        <Card title="Google Drive" icon={<Cloud size={13} />}>
          {driveNotice && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600,
              padding: '8px 12px', borderRadius: 8, marginBottom: 16,
              color: driveNotice.kind === 'success' ? '#166534' : '#991B1B',
              background: driveNotice.kind === 'success' ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${driveNotice.kind === 'success' ? '#BBF7D0' : '#FECACA'}`,
            }}>
              {driveNotice.kind === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {driveNotice.message}
            </div>
          )}

          {driveLoading ? (
            <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)' }}>Checking connection status…</p>
          ) : driveStatus?.connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#166534' }}>
                <CheckCircle2 size={16} /> Connected
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div>
                  <FieldLabel>Google Account Email</FieldLabel>
                  <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>{driveStatus.email || '—'}</p>
                </div>
                <div>
                  <FieldLabel>Drive Root Folder</FieldLabel>
                  <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>{driveStatus.rootFolderName || 'Arna Intelligence IntelliPayRoll'}</p>
                </div>
                <div>
                  <FieldLabel>Connected Since</FieldLabel>
                  <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>
                    {driveStatus.connectedAt ? new Date(driveStatus.connectedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
                <div>
                  <FieldLabel>Last Verified</FieldLabel>
                  <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>
                    {driveStatus.lastVerifiedAt ? new Date(driveStatus.lastVerifiedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--clr-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Storage</p>
                {driveStatsLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)', margin: 0 }}>Loading storage stats…</p>
                ) : driveStats ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                    <div>
                      <FieldLabel>Storage Used</FieldLabel>
                      <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>{formatBytes(driveStats.totalStorageBytes)}</p>
                    </div>
                    <div>
                      <FieldLabel>Salary Slips Stored</FieldLabel>
                      <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>{driveStats.totalFiles}</p>
                    </div>
                    <div>
                      <FieldLabel>Last Uploaded File</FieldLabel>
                      <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0, wordBreak: 'break-word' }}>{driveStats.lastUploadedFile || '—'}</p>
                    </div>
                    <div>
                      <FieldLabel>Last Upload Time</FieldLabel>
                      <p style={{ fontSize: 12.5, color: 'var(--clr-text)', margin: 0 }}>
                        {driveStats.lastUploadedAt ? new Date(driveStats.lastUploadedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)', margin: 0 }}>Storage stats unavailable right now.</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--clr-border)', paddingTop: 14 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleTestDrive} disabled={!!driveActionPending}>
                  <RefreshCw size={13} /> {driveActionPending === 'test' ? 'Testing…' : 'Run Connection Test'}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleConnectDrive} disabled={!!driveActionPending}>
                  <Cloud size={13} /> {driveActionPending === 'connect' ? 'Redirecting…' : 'Reconnect'}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 12, color: '#991B1B' }} onClick={handleDisconnectDrive} disabled={!!driveActionPending}>
                  <XCircle size={13} /> {driveActionPending === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12.5, color: 'var(--clr-text-subtle)', margin: 0 }}>
                Connect Google Drive once to automatically upload every generated salary slip into
                "Arna Intelligence IntelliPayRoll" / Year / Month, organised alongside the local archive.
              </p>
              <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} onClick={handleConnectDrive} disabled={!!driveActionPending}>
                <Cloud size={13} /> {driveActionPending === 'connect' ? 'Redirecting…' : 'Connect Google Drive'}
              </button>
            </div>
          )}
        </Card>
      )}

      {tab === 'display' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Display Options">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {DISPLAY_TOGGLES.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--clr-text)', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={!!draft[key]}
                    onChange={e => patch({ [key]: e.target.checked })}
                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: draft.primaryColour }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          <SaveBar dirty={isDirty} onSave={() => handleSave('Display options')} label="Save Display Options" />
        </div>
      )}
    </div>
  );
}
