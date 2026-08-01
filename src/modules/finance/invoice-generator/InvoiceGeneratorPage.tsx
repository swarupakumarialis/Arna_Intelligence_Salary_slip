import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Save, RotateCcw, FileCheck2, User, ClipboardList, ListChecks, Calculator, FileText, Pencil, Loader2,
  Download, Printer, Mail, ExternalLink, Cloud,
} from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { Card } from '../../../components/ui/Card';
import { StatusBadge, BadgeTone } from '../../../components/ui/StatusBadge';
import { CURRENCY_CODES, CURRENCY_META, CurrencyCode, formatAmount } from '../../../utils/currencyService';
import { loadCompanySettings } from '../../../utils/companySettingsStore';
import { loadInvoiceSettings } from '../utils/invoiceSettingsStore';
import {
  CustomerDetails, Invoice, InvoiceDetails, InvoiceItem, InvoiceStatus, PAYMENT_TERMS, INVOICE_STATUSES,
} from '../types';
import { computeInvoiceTotals, createBlankInvoiceItem, todayIso } from '../utils';
import { ApiError, createInvoice, emailInvoice, getInvoice, updateInvoice, uploadInvoicePdf } from '../services/invoiceApi';
import { InvoicePreview } from './components/InvoicePreview';
import { PreviewToolbar } from './components/PreviewToolbar';
import { EmailInvoiceModal } from './components/EmailInvoiceModal';
import { InvoicePdf } from './pdf/InvoicePdf';
import { generateInvoicePdf } from './pdf/generateInvoicePdf';

/** What Invoice History asks the Generator to open (Sprint 4). There is
    no URL router in this app (see App.tsx's SidebarKey/activePage
    state), so "navigate to invoice X in edit/view mode" has to be
    passed as an explicit prop from App.tsx rather than a route param —
    App.tsx lifts just this one small piece of state, not the whole
    Invoice module, keeping the module itself self-contained. */
export interface InvoiceOpenRequest {
  id: string;
  mode: 'edit' | 'view';
  /** When the caller already has the full record in hand — Invoice
      History's rows are already fetched in full, and its Preview modal
      already holds the exact invoice being viewed — pass it here so
      opening Edit/View skips a redundant GET /invoices/:id round-trip.
      This is what used to make "click pencil in Invoice History" show
      a "Loading invoice…" spinner for however long that request took,
      for data the caller already had on screen a moment earlier.
      Optional so a caller with only an id (none currently) still works
      via the fetch-by-id fallback below. */
  invoice?: Invoice;
}

interface Props {
  openRequest?: InvoiceOpenRequest | null;
  onOpenRequestHandled?: () => void;
  /** Fires whenever "does this form have changes that would be lost if
      the user navigated away right now" flips — App.tsx uses this to
      warn before switching the sidebar to another page, since this
      component (and all its local state) unmounts on navigation away
      from 'invoice-generator', unlike the Salary Generator whose form
      state lives in App.tsx and survives a page switch. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Whether the sidebar is currently manually hidden (App.tsx's own
      state) — used to default the Live Preview zoom to 100% when it's
      hidden (more room) and 75% when it's shown, the same way the
      Salary Generator's own Live Preview behaves. */
  sidebarCollapsed?: boolean;
}

/**
 * Finance module — Invoice Generator (Sprint 2: form; Sprint 3: live
 * preview). Entirely local component state — no API calls, no
 * MongoDB, no PDF, no email, no Google Drive. Independent of the
 * Salary Generator: reuses only read-only, stateless design-system
 * pieces (PageHeader, Card, Breadcrumb, the `.field`/`.btn`/
 * `.main-grid`/`.preview-shell`/`.preview-toolbar*` CSS classes, and
 * currencyService's pure formatting helpers) — never
 * SalarySlipForm/SalarySlipPreview/App.tsx state, never the payroll
 * CurrencyContext (an invoice's currency is its own field here, not
 * tied to the company's configured display currency).
 *
 * State ownership (Sprint 3 requirement — no duplicate state): this
 * component is the ONLY owner of customer/invoice/items/discount.
 * InvoicePreview and every component under invoice-generator/
 * components/ receive that same state as props and render it; none
 * of them hold their own copy or recompute totals independently.
 */

function emptyCustomerDetails(): CustomerDetails {
  return { customerName: '', companyName: '', email: '', phone: '', gstin: '', billingAddress: '' };
}

/** Sprint 7 — currency defaults from Invoice Settings rather than a
    hardcoded 'INR', so a new invoice already reflects the configured
    default (Part 1: "these settings should automatically populate new
    invoices"). */
function defaultInvoiceDetails(): InvoiceDetails {
  return { invoiceDate: todayIso(), dueDate: '', paymentTerms: 'Due on Receipt', currency: loadInvoiceSettings().defaultCurrency, status: 'Draft' };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--clr-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

/** Local, small-footprint counterpart to SalarySlipForm.tsx's own
    FieldLabel/FieldError/error-styling convention (Sprint 6) — same
    visual language (red asterisk, red border + soft glow, dotted red
    error line) so Invoice forms feel consistent with the rest of the
    app, reimplemented here rather than imported so the Invoice module
    stays independent of Salary code. */
function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <div id={id} role="alert" style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#DC2626', flexShrink: 0, display: 'inline-block' }} />
      {message}
    </div>
  );
}

function errorFieldStyle(error?: string): React.CSSProperties | undefined {
  return error ? { borderColor: '#FCA5A5', boxShadow: '0 0 0 3px rgba(220,38,38,0.10)' } : undefined;
}

/** Visible "42/200" counter for fields given a maxLength — shown next
    to the label rather than only relying on the browser's silent
    HTML maxLength enforcement, so the limit is mentioned in the UI
    itself, not just discovered by hitting it. Turns red once the
    field is actually at its limit. */
function CharCounter({ length, max }: { length: number; max: number }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: length >= max ? '#DC2626' : 'var(--clr-text-subtle)' }}>
      {length}/{max}
    </span>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

/** Declared as React.FC (not a plain function) — a plain
    `function Field(...)` declaration with a props interface extending
    React.InputHTMLAttributes tripped the same TS/JSX inference quirk
    documented on ItemRow above (Sprint 2); React.FC sidesteps it here
    too. */
const Field: React.FC<FieldProps> = ({ label, hint, error, required, id, style, ...props }) => {
  const errorId = error && id ? `${id}-error` : undefined;
  const hasCounter = typeof props.maxLength === 'number' && typeof props.value === 'string';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor={id}>
          {label}{required && <span style={{ color: '#DC2626', marginLeft: 3 }} aria-hidden="true">*</span>}
        </label>
        {hasCounter && <CharCounter length={(props.value as string).length} max={props.maxLength as number} />}
      </div>
      <input
        {...props}
        id={id}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        aria-required={required || undefined}
        style={{ ...style, ...errorFieldStyle(error) }}
      />
      {error ? <FieldError id={errorId} message={error} /> : hint && <p style={{ fontSize: 10.5, color: 'var(--clr-text-subtle)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
};

function SelectField({
  label, children, id, ...props
}: { label: string; children: React.ReactNode; id?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <select {...props} id={id} className="field">{children}</select>
    </div>
  );
}

function TextAreaField({
  label, error, id, style, ...props
}: { label: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const errorId = error && id ? `${id}-error` : undefined;
  const hasCounter = typeof props.maxLength === 'number' && typeof props.value === 'string';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor={id}>{label}</label>
        {hasCounter && <CharCounter length={(props.value as string).length} max={props.maxLength as number} />}
      </div>
      <textarea
        {...props} id={id} className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        style={{ resize: 'vertical', minHeight: 76, fontFamily: 'inherit', ...style, ...errorFieldStyle(error) }}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface ItemErrors {
  description?: string;
  quantity?: string;
  unitPrice?: string;
}

interface ItemRowProps {
  item: InvoiceItem;
  index: number;
  currency: CurrencyCode;
  removeDisabled: boolean;
  errors?: ItemErrors;
  onChange: (patch: Partial<InvoiceItem>) => void;
  onBlurField: (field: keyof ItemErrors) => void;
  onRemove: () => void;
}

const itemErrorStyle: React.CSSProperties = { borderColor: '#FCA5A5', background: '#FEF2F2' };

/** One editable row of the Items table. Amount is always derived
    (quantity × unitPrice), never itself an input — matches the
    "Amount auto-calculates" requirement literally: there is no
    onChange path that can set it directly. Declared as React.FC (not
    a plain function) — a plain `function ItemRow(...)` declaration
    tripped a TS/JSX inference quirk in this project (see Sprint 2).
    Sprint 6: per-field validation (no empty description, qty/price > 0),
    shown only once that specific cell has been blurred (or a save was
    attempted) — mirrors the same touched-field gating the rest of the
    form uses, so a fresh blank row doesn't show three errors at once
    before the user has typed anything. */
const ItemRow: React.FC<ItemRowProps> = ({ item, index, currency, removeDisabled, errors, onChange, onBlurField, onRemove }) => {
  const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const cellInputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 9px', background: '#f9fafb', border: '1.5px solid transparent',
    borderRadius: 7, fontSize: 12.5, color: 'var(--clr-text)', fontFamily: 'inherit', outline: 'none',
    transition: 'all 150ms',
  };
  const onFocusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--brand-primary)';
    e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-primary) 12%, transparent)';
  };
  const clearFocusStyle = (e: React.FocusEvent<HTMLInputElement>, hasError?: string) => {
    e.currentTarget.style.borderColor = hasError ? '#FCA5A5' : 'transparent';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <tr className="data-row">
      <td style={{ padding: '8px 10px', minWidth: 220 }}>
        <input
          type="text" placeholder={`Item ${index + 1} description`} value={item.description}
          aria-label={`Item ${index + 1} description`} aria-invalid={!!errors?.description}
          onChange={e => onChange({ description: e.target.value })}
          onFocus={onFocusStyle} onBlur={e => { clearFocusStyle(e, errors?.description); onBlurField('description'); }}
          style={{ ...cellInputStyle, ...(errors?.description ? itemErrorStyle : undefined) }}
          maxLength={200}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <div style={{ flex: 1 }}>{errors?.description && <FieldError message={errors.description} />}</div>
          <CharCounter length={item.description.length} max={200} />
        </div>
      </td>
      <td style={{ padding: '8px 10px', width: 90 }}>
        <input
          type="number" min={0} value={item.quantity}
          aria-label={`Item ${index + 1} quantity`} aria-invalid={!!errors?.quantity}
          onChange={e => onChange({ quantity: Number(e.target.value) })}
          onFocus={onFocusStyle} onBlur={e => { clearFocusStyle(e, errors?.quantity); onBlurField('quantity'); }}
          style={{ ...cellInputStyle, textAlign: 'right', ...(errors?.quantity ? itemErrorStyle : undefined) }}
        />
        {errors?.quantity && <FieldError message={errors.quantity} />}
      </td>
      <td style={{ padding: '8px 10px', width: 130 }}>
        <input
          type="number" min={0} value={item.unitPrice}
          aria-label={`Item ${index + 1} unit price`} aria-invalid={!!errors?.unitPrice}
          onChange={e => onChange({ unitPrice: Number(e.target.value) })}
          onFocus={onFocusStyle} onBlur={e => { clearFocusStyle(e, errors?.unitPrice); onBlurField('unitPrice'); }}
          style={{ ...cellInputStyle, textAlign: 'right', ...(errors?.unitPrice ? itemErrorStyle : undefined) }}
        />
        {errors?.unitPrice && <FieldError message={errors.unitPrice} />}
      </td>
      <td style={{ padding: '8px 10px', width: 90 }}>
        <input
          type="number" min={0} max={100} value={item.taxPercent}
          aria-label={`Item ${index + 1} tax percent`}
          onChange={e => onChange({ taxPercent: Number(e.target.value) })}
          onFocus={onFocusStyle} onBlur={e => clearFocusStyle(e)}
          style={{ ...cellInputStyle, textAlign: 'right' }}
        />
      </td>
      <td style={{
        padding: '8px 14px', width: 140, textAlign: 'right', fontWeight: 700,
        color: 'var(--clr-text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
      }}>
        {formatAmount(amount, currency)}
      </td>
      <td style={{ padding: '8px 10px', width: 44, textAlign: 'center' }}>
        <button
          type="button" onClick={onRemove} disabled={removeDisabled}
          className="btn-icon" title="Remove item" aria-label={`Remove item ${index + 1}`}
          style={{ border: 'none', cursor: removeDisabled ? 'not-allowed' : 'pointer', opacity: removeDisabled ? 0.35 : 1 }}
          onMouseEnter={e => { if (!removeDisabled) { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
};

function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: emphasis ? '10px 0 0' : '6px 0',
      borderTop: emphasis ? '1px solid var(--clr-border)' : undefined,
      marginTop: emphasis ? 6 : 0,
    }}>
      <span style={{ fontSize: emphasis ? 13 : 12, fontWeight: emphasis ? 700 : 500, color: emphasis ? 'var(--clr-text)' : 'var(--clr-text-muted)' }}>
        {label}
      </span>
      <span style={{
        fontSize: emphasis ? 16 : 12.5, fontWeight: 700,
        color: emphasis ? 'var(--brand-primary)' : 'var(--clr-text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  );
}

/* Live Preview zoom — mirrors App.tsx's Salary Generator zoom
   mechanics (same A4 pixel reference, same step table), but is its
   own independent state: nothing here is shared with or read from
   App.tsx. 'fixed' means previewScale is whatever the toolbar last
   set directly; 'fit' means it's recomputed on every resize to fit
   the shell (see the effect below). */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const A4_PX_WIDTH = 794;
const A4_PX_HEIGHT = 1123;

const EMAIL_STATUS_TONE: Record<'Pending' | 'Sent' | 'Failed', BadgeTone> = {
  Pending: 'neutral', Sent: 'success', Failed: 'danger',
};

/* ── Validation (Sprint 6) ──────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Standard 15-character Indian GSTIN format: 2-digit state code, 10-
    character PAN, 1-digit entity code, 'Z' by convention, 1 checksum
    character. */
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_RE = /^[+]?[\d\s-]{7,15}$/;

interface InvoiceFormErrors {
  customerName?: string;
  email?: string;
  gstin?: string;
  phone?: string;
  dueDate?: string;
  discount?: string;
  items?: string;
}

/** All of "Customer required/email format/GST format/phone format",
    "item minimums", and "due date >= invoice date" in one place, so
    Save/Generate and the inline field errors always agree on what's
    valid — there's no second, looser check anywhere else. Item rows
    are validated individually (itemErrors, keyed by item.id) so each
    row's own cells can show their own message rather than one generic
    "items are invalid" banner. */
function validateInvoiceForm(
  customer: CustomerDetails, invoice: InvoiceDetails, items: InvoiceItem[], discount: number, subtotal: number
): { errors: InvoiceFormErrors; itemErrors: Record<string, ItemErrors> } {
  const errors: InvoiceFormErrors = {};

  if (!customer.customerName.trim()) errors.customerName = 'Customer name is required.';
  if (customer.email.trim() && !EMAIL_RE.test(customer.email.trim())) errors.email = 'Enter a valid email address.';
  if (customer.gstin.trim() && !GSTIN_RE.test(customer.gstin.trim())) errors.gstin = 'Enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).';
  if (customer.phone.trim() && !PHONE_RE.test(customer.phone.trim())) errors.phone = 'Enter a valid phone number.';

  if (invoice.invoiceDate && invoice.dueDate && invoice.dueDate < invoice.invoiceDate) {
    errors.dueDate = 'Due date cannot be before the invoice date.';
  }

  if (discount < 0) errors.discount = 'Discount cannot be negative.';
  else if (subtotal > 0 && discount > subtotal) errors.discount = 'Discount cannot exceed the subtotal.';

  const itemErrors: Record<string, ItemErrors> = {};
  items.forEach((item) => {
    const rowErrors: ItemErrors = {};
    if (!item.description.trim()) rowErrors.description = 'Description is required.';
    if (!(Number(item.quantity) > 0)) rowErrors.quantity = 'Must be > 0.';
    if (!(Number(item.unitPrice) > 0)) rowErrors.unitPrice = 'Must be > 0.';
    if (Object.keys(rowErrors).length > 0) itemErrors[item.id] = rowErrors;
  });
  if (items.length === 0) errors.items = 'Add at least one item.';
  else if (Object.keys(itemErrors).length > 0) errors.items = 'Fix the highlighted item.';

  return { errors, itemErrors };
}

/** Invoice Generator — Sprint 2 form, Sprint 3 live preview, Sprint 4
    real persistence. Create/Edit/View all share this one component and
    this one piece of state (no separate "view" component/state copy):
    View mode just locks the form visually and swaps the footer actions
    for a single "Edit Invoice" button; Edit mode is Create's same
    save flow, routed to PUT instead of POST because `savedId` is set. */
export function InvoiceGeneratorPage({ openRequest, onOpenRequestHandled, onDirtyChange, sidebarCollapsed }: Props = {}) {
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomerDetails);
  const [invoice, setInvoice] = useState<InvoiceDetails>(defaultInvoiceDetails);
  const [items, setItems] = useState<InvoiceItem[]>([createBlankInvoiceItem()]);
  const [discount, setDiscount] = useState(0);
  /* Sprint 7 — seeded from Invoice Settings' defaults for a brand-new
     invoice, then edited/persisted per-invoice from here on (loaded
     from the record itself in the openRequest effect below, never
     re-defaulted on edit). */
  const [notes, setNotes] = useState(() => loadInvoiceSettings().defaultNotes);
  const [terms, setTerms] = useState(() => loadInvoiceSettings().defaultTerms);
  const [notice, setNotice] = useState<string | null>(null);
  /* Part 5 — synchronous duplicate-submission guard. `saving` (React
     state) can't prevent a second persistInvoice() call fired before
     the disabled-button re-render commits; this ref is checked/set
     before any await, so a rapid double-click can never start two
     save requests. */
  const isSavingRef = useRef(false);

  /* Sprint 6 — validation touched-state, same gating pattern App.tsx's
     Salary Generator uses (touchedFields + a forced "show everything"
     flag once a save is actually attempted), so a fresh blank form
     never opens already covered in red. */
  const [touched, setTouched] = useState<Partial<Record<keyof InvoiceFormErrors, boolean>>>({});
  const [itemsTouched, setItemsTouched] = useState<Record<string, Partial<Record<keyof ItemErrors, boolean>>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('create');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Sprint 5 — PDF/Drive/Email state. driveFileUrl/emailStatusValue
     mirror what's stored on the backend Invoice document (see
     services/invoiceApi.ts's Invoice type); populated when an existing
     invoice is loaded, and updated locally after each action succeeds. */
  const [driveFileUrl, setDriveFileUrl] = useState<string | null>(null);
  const [emailStatusValue, setEmailStatusValue] = useState<'Pending' | 'Sent' | 'Failed' | null>(null);
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const [zoomMode, setZoomMode] = useState<'fixed' | 'fit'>('fixed');
  const [previewScale, setPreviewScale] = useState(0.75);
  const shellRef = useRef<HTMLDivElement>(null);

  /* Hiding the sidebar frees up real width, so the Live Preview should
     make use of it immediately — 90% instead of the normal 75% default,
     and back to 75% once the sidebar is shown again. Only applies in
     'fixed' zoom mode; 'fit' already recomputes against the shell's
     actual size via its own ResizeObserver (see recalcFit below), so
     this would just fight that. Same behaviour as the Salary Generator's
     own Live Preview in App.tsx. */
  useEffect(() => {
    if (zoomMode !== 'fixed') return;
    setPreviewScale(sidebarCollapsed ? 0.9 : 0.75);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarCollapsed]);

  const patchCustomer = (patch: Partial<CustomerDetails>) => setCustomer(prev => ({ ...prev, ...patch }));
  const patchInvoice = (patch: Partial<InvoiceDetails>) => setInvoice(prev => ({ ...prev, ...patch }));

  const patchItem = (id: string, patch: Partial<InvoiceItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };
  const addItem = () => setItems(prev => [...prev, createBlankInvoiceItem()]);
  const removeItem = (id: string) => setItems(prev => (prev.length > 1 ? prev.filter(item => item.id !== id) : prev));

  /** Snapshot of everything a save actually persists (payload shape,
      not UI-only state like `touched`/`mode`) — compared against the
      live form on every render to decide whether there are unsaved
      changes. Baselined on mount (blank form = "clean"), then
      re-baselined after a successful load or save; see the effect and
      the two spots below that reassign `savedSnapshotRef.current`. */
  const serializeFormState = () => JSON.stringify({ customer, invoice, items, discount, notes, terms });
  const savedSnapshotRef = useRef<string>('');
  useEffect(() => {
    if (!savedSnapshotRef.current) savedSnapshotRef.current = serializeFormState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isDirty = savedSnapshotRef.current !== '' && serializeFormState() !== savedSnapshotRef.current;
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);
  /* Tells App.tsx there's nothing left to lose right before unmount —
     without this, closing the tab/switching pages right after a fresh
     "Form cleared" or a load that hasn't diverged yet would otherwise
     rely on a stale `true` from the render just before this one. */
  useEffect(() => () => { onDirtyChange?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  // Computed early (not just before the JSX return) so validation
  // below can reference totals.subtotal without a second subtotal
  // calculation of its own (Part 9 — avoid duplicate computations).
  const totals = useMemo(() => computeInvoiceTotals(items, discount), [items, discount]);

  /** Part 9 — loadCompanySettings() reads + JSON.parses localStorage;
      memoized once per mount (same pattern InvoicePreview.tsx/
      InvoicePdf.tsx already use) instead of being called fresh on
      every render just to read the email modal's companyName prop. */
  const brand = useMemo(() => loadCompanySettings(), []);

  const { errors: formErrors, itemErrors } = useMemo(
    () => validateInvoiceForm(customer, invoice, items, discount, totals.subtotal),
    [customer, invoice, items, discount, totals.subtotal]
  );

  const markTouched = (field: keyof InvoiceFormErrors) => setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  const markItemTouched = (id: string, field: keyof ItemErrors) =>
    setItemsTouched(prev => (prev[id]?.[field] ? prev : { ...prev, [id]: { ...prev[id], [field]: true } }));
  const shownError = (field: keyof InvoiceFormErrors): string | undefined =>
    (touched[field] || submitAttempted) ? formErrors[field] : undefined;
  const shownItemError = (id: string): ItemErrors | undefined => {
    const rowErrors = itemErrors[id];
    if (!rowErrors) return undefined;
    const rowTouched = itemsTouched[id] || {};
    const visible: ItemErrors = {};
    (Object.keys(rowErrors) as (keyof ItemErrors)[]).forEach((field) => {
      if (rowTouched[field] || submitAttempted) visible[field] = rowErrors[field];
    });
    return Object.keys(visible).length > 0 ? visible : undefined;
  };

  const handleClear = () => {
    const blankCustomer = emptyCustomerDetails();
    const blankInvoice = defaultInvoiceDetails();
    const blankItems = [createBlankInvoiceItem()];
    const settings = loadInvoiceSettings();
    setCustomer(blankCustomer);
    setInvoice(blankInvoice);
    setItems(blankItems);
    setDiscount(0);
    setNotes(settings.defaultNotes);
    setTerms(settings.defaultTerms);
    setMode('create');
    setSavedId(null);
    setInvoiceNumber(null);
    setLoadError(null);
    setDriveFileUrl(null);
    setEmailStatusValue(null);
    setTouched({});
    setItemsTouched({});
    setSubmitAttempted(false);
    savedSnapshotRef.current = JSON.stringify({
      customer: blankCustomer, invoice: blankInvoice, items: blankItems,
      discount: 0, notes: settings.defaultNotes, terms: settings.defaultTerms,
    });
    showNotice('Form cleared.');
  };

  /** Populates every piece of form state from a fetched-or-already-had
      Invoice record and re-baselines the dirty-tracking snapshot.
      Shared by both branches of the effect below — the network fetch
      and the pre-fetched fast path — so they can never drift apart. */
  const applyLoadedInvoice = (inv: Invoice, mode: 'edit' | 'view') => {
    const loadedCustomer = {
      customerName: inv.customerName, companyName: inv.companyName, email: inv.email,
      phone: inv.phone, gstin: inv.gstin, billingAddress: inv.billingAddress,
    };
    const loadedInvoice = {
      invoiceDate: inv.invoiceDate, dueDate: inv.dueDate, paymentTerms: inv.paymentTerms,
      currency: inv.currency, status: inv.status,
    };
    const loadedItems = inv.items.length ? inv.items : [createBlankInvoiceItem()];
    setCustomer(loadedCustomer);
    setInvoice(loadedInvoice);
    setItems(loadedItems);
    setDiscount(inv.discount);
    setNotes(inv.notes);
    setTerms(inv.termsAndConditions);
    setSavedId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setDriveFileUrl(inv.driveFileUrl ?? null);
    setEmailStatusValue(inv.emailStatus ?? null);
    setTouched({});
    setItemsTouched({});
    savedSnapshotRef.current = JSON.stringify({
      customer: loadedCustomer, invoice: loadedInvoice, items: loadedItems,
      discount: inv.discount, notes: inv.notes, terms: inv.termsAndConditions,
    });
    setSubmitAttempted(false);
    setMode(mode);
  };

  /* Sprint 4 Part 6/7 — View/Edit: Invoice History hands this page an
     { id, mode } request (see InvoiceOpenRequest above); it has no
     other way to say "open this saved invoice". Consumed exactly once
     via onOpenRequestHandled, which the parent uses to null the
     request back out so re-render/re-navigation doesn't refetch.
     When the caller already attached the full record (Invoice History
     always does — its rows and its Preview modal both already have it
     in hand), apply it directly with no network round-trip and no
     "Loading invoice…" spinner at all; only fall back to fetching by id
     when a future caller opens Edit/View with just an id. */
  useEffect(() => {
    if (!openRequest) return;
    if (openRequest.invoice) {
      applyLoadedInvoice(openRequest.invoice, openRequest.mode);
      onOpenRequestHandled?.();
      return;
    }
    let cancelled = false;
    setLoadingRecord(true);
    setLoadError(null);
    getInvoice(openRequest.id)
      .then((inv) => {
        if (cancelled) return;
        applyLoadedInvoice(inv, openRequest.mode);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Failed to load invoice.');
      })
      .finally(() => {
        if (!cancelled) setLoadingRecord(false);
        onOpenRequestHandled?.();
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  /** Shared by both footer actions — the only difference between
      "Save as Draft" and "Generate Invoice" is which status gets
      saved; both POST when there's no savedId yet and PUT once one
      exists, so repeated draft saves update the same document instead
      of creating duplicates (Part 4). Returns the saved invoice (or
      null on failure) so handleGenerate can chain the Sprint 5 PDF/
      Drive pipeline onto a successful save. Sprint 6: validation is
      now the full field-level check (see validateInvoiceForm) — a
      failed attempt forces every error to become visible (touched
      fields alone wouldn't surface a row the user never touched) and
      relies on the inline messages rather than a generic banner,
      per "show friendly validation messages" being about the field
      itself, not a popup. Sprint 7 Part 5: `isSavingRef` is a
      synchronous guard against duplicate submissions — checked and set
      before any await, so a double-click can't start two overlapping
      save requests the way relying on the `saving` state alone could
      (that state only takes effect once React re-renders the disabled
      button). */
  const persistInvoice = async (statusOverride?: InvoiceStatus) => {
    if (isSavingRef.current) return null;

    const hasErrors = Object.keys(formErrors).length > 0;
    if (hasErrors) {
      setSubmitAttempted(true);
      showNotice('Please fix the highlighted fields before saving.');
      return null;
    }

    isSavingRef.current = true;
    setSaving(true);
    const payload = {
      ...customer, ...invoice, status: statusOverride ?? invoice.status, items, discount,
      notes, termsAndConditions: terms,
    };
    try {
      const saved = savedId
        ? await updateInvoice(savedId, payload)
        : await createInvoice(payload, loadInvoiceSettings().invoicePrefix);
      setSavedId(saved.id);
      setInvoiceNumber(saved.invoiceNumber);
      if (statusOverride) patchInvoice({ status: statusOverride });
      setMode('edit');
      savedSnapshotRef.current = JSON.stringify({
        customer, invoice: { ...invoice, status: statusOverride ?? invoice.status },
        items, discount, notes, terms,
      });
      return saved;
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : 'Failed to save invoice. Please check your connection and try again.');
      return null;
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleSaveDraft = async () => {
    const saved = await persistInvoice('Draft');
    if (saved) showNotice(`Invoice ${saved.invoiceNumber} saved as draft.`);
  };

  /** Part 5's workflow: Generate Invoice → Generate PDF → Upload PDF →
      Save Google Drive File ID → Update MongoDB. The Mongo save above
      is step one; once it succeeds, this chains PDF generation +
      Drive upload onto it automatically. A Drive failure (e.g. not
      connected yet) is caught and reported as a softer warning — the
      invoice itself is already safely saved either way, matching
      pdfStorage.service.js's storePdf "best-effort, never turn a
      successful save into a failure" precedent for the Salary PDF's
      own Drive upload. */
  const handleGenerate = async () => {
    const saved = await persistInvoice();
    if (!saved) return;

    setUploadingDrive(true);
    try {
      if (!pdfRef.current) throw new Error('PDF render target is not ready');
      const { blob, fileName } = await generateInvoicePdf(pdfRef.current, saved.invoiceNumber);
      const withDrive = await uploadInvoicePdf(saved.id, blob, fileName);
      setDriveFileUrl(withDrive.driveFileUrl ?? null);
      showNotice(`Invoice ${saved.invoiceNumber} generated and uploaded to Google Drive.`);
    } catch (err) {
      console.error('[invoice] Google Drive upload failed:', err);
      showNotice(
        `Invoice ${saved.invoiceNumber} saved, but Google Drive upload failed` +
        `${err instanceof ApiError ? `: ${err.message}` : '.'}`
      );
    } finally {
      setUploadingDrive(false);
    }
  };

  /** Download/Print/Open PDF are read-only actions that only need the
      off-screen InvoicePdf render (always mounted, see below) — they
      never required a saved record, so they no longer gate on
      invoiceNumber like Email/Open-in-Drive genuinely must (those two
      call backend endpoints tied to an existing invoice id). A draft
      that hasn't been saved yet gets a "Invoice-Draft" fallback
      filename instead of blocking the action outright — this is the
      fix for "download not working" on an unsaved invoice. */
  const draftFileLabel = () => invoiceNumber ?? 'Invoice-Draft';

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      const { pdf, fileName } = await generateInvoicePdf(pdfRef.current, draftFileLabel());
      pdf.save(fileName);
    } catch (err) {
      console.error('[invoice] PDF download failed:', err);
      showNotice('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  /** Print Invoice — toggles the .invoice-printing class the scoped
      print CSS (index.css) gates on, so #invoice-pdf-area is the only
      thing the browser prints; window.print() itself renders the live
      DOM, not a rasterized image, so this is higher print quality than
      the Download PDF path for content that spans multiple pages. */
  const handlePrint = () => {
    const cleanup = () => {
      document.body.classList.remove('invoice-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.classList.add('invoice-printing');
    window.print();
  };

  const handleOpenPdf = async () => {
    if (!pdfRef.current) return;
    setOpeningPdf(true);
    try {
      const { blob } = await generateInvoicePdf(pdfRef.current, draftFileLabel());
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (err) {
      console.error('[invoice] PDF open failed:', err);
      showNotice('Failed to generate PDF. Please try again.');
    } finally {
      setOpeningPdf(false);
    }
  };

  const handleOpenDrive = () => {
    if (driveFileUrl) window.open(driveFileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmail = async (to: string, subject: string) => {
    if (!pdfRef.current || !savedId || !invoiceNumber) return;
    setEmailSending(true);
    try {
      const { blob } = await generateInvoicePdf(pdfRef.current, invoiceNumber);
      const updated = await emailInvoice(savedId, {
        recipientEmail: to, subject, companyName: brand.companyName, pdfBlob: blob,
      });
      setEmailStatusValue(updated.emailStatus ?? 'Sent');
      setEmailModalOpen(false);
      showNotice(`Invoice emailed to ${to}.`);
    } catch (err) {
      console.error('[invoice] Email send failed:', err);
      setEmailStatusValue('Failed');
      showNotice(err instanceof ApiError ? err.message : 'Failed to send email.');
    } finally {
      setEmailSending(false);
    }
  };

  const fmt = (n: number) => formatAmount(n, invoice.currency);
  const isViewMode = mode === 'view';

  const recalcFit = useCallback(() => {
    if (!shellRef.current) return;
    const padding = 48;
    const shellW = shellRef.current.clientWidth - padding;
    const shellH = shellRef.current.clientHeight - padding;
    setPreviewScale(Math.max(0.25, Math.min(shellW / A4_PX_WIDTH, shellH / A4_PX_HEIGHT)));
  }, []);

  useEffect(() => {
    if (zoomMode !== 'fit') return;
    recalcFit();
    const ro = new ResizeObserver(recalcFit);
    if (shellRef.current) ro.observe(shellRef.current);
    return () => ro.disconnect();
  }, [zoomMode, recalcFit]);

  const handleZoomIn = useCallback(() => {
    setZoomMode('fixed');
    setPreviewScale(prev => ZOOM_STEPS.find(s => s > prev + 0.001) ?? prev);
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoomMode('fixed');
    setPreviewScale(prev => [...ZOOM_STEPS].reverse().find(s => s < prev - 0.001) ?? prev);
  }, []);
  const handleSetZoom = useCallback((pct: number) => {
    setZoomMode('fixed');
    setPreviewScale(pct / 100);
  }, []);
  const handleFitToScreen = useCallback(() => setZoomMode('fit'), []);

  const pageTitle = mode === 'view' ? 'View Invoice' : mode === 'edit' ? 'Edit Invoice' : 'Invoice Generator';
  const pageDescription = mode === 'create'
    ? 'Create and manage professional invoices.'
    : `${mode === 'view' ? 'Viewing' : 'Editing'} ${invoiceNumber ?? ''}`;

  return (
    <div className="animate-fade-in-up">
      <Breadcrumb items={[{ label: 'Finance' }, { label: pageTitle }]} />
      <PageHeader title={pageTitle} description={pageDescription} />

      {/* Sprint 5, Part 7 — Invoice Actions, available once the invoice
          has been saved at least once (Download/Print/Email/Open PDF
          all need a real invoiceNumber; Open in Drive needs a prior
          successful upload). Same actions are also available from
          Invoice History (see InvoiceHistoryPage.tsx). */}
      {savedId && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2 }}>
            Invoice Actions
          </span>
          <button type="button" onClick={handleDownload} disabled={downloading} className="btn btn-secondary" style={{ fontSize: 12 }}>
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download PDF
          </button>
          <button type="button" onClick={handlePrint} className="btn btn-secondary" style={{ fontSize: 12 }}>
            <Printer size={13} /> Print
          </button>
          <button
            type="button" onClick={() => setEmailModalOpen(true)} disabled={!customer.email.trim()}
            className="btn btn-secondary" style={{ fontSize: 12, opacity: customer.email.trim() ? 1 : 0.5 }}
            title={customer.email.trim() ? undefined : 'No customer email on file — add one in Customer Details first'}
          >
            <Mail size={13} /> Email Invoice
          </button>
          <button type="button" onClick={handleOpenPdf} disabled={openingPdf} className="btn btn-secondary" style={{ fontSize: 12 }}>
            {openingPdf ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />} Open PDF
          </button>
          <button
            type="button" onClick={handleOpenDrive} disabled={!driveFileUrl} className="btn btn-secondary"
            style={{ fontSize: 12, opacity: driveFileUrl ? 1 : 0.5, cursor: driveFileUrl ? 'pointer' : 'not-allowed' }}
            title={driveFileUrl ? 'Open the archived PDF in Google Drive' : 'Not uploaded to Google Drive yet — click Generate Invoice'}
          >
            <Cloud size={13} /> Open in Drive
          </button>
          {uploadingDrive && (
            <span style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} className="animate-spin" /> Uploading to Google Drive…
            </span>
          )}
          {emailStatusValue && (
            <StatusBadge label={`Email: ${emailStatusValue}`} tone={EMAIL_STATUS_TONE[emailStatusValue]} />
          )}
        </div>
      )}

      {loadingRecord && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'var(--clr-bg)', border: '1px solid var(--clr-border)',
          fontSize: 12.5, fontWeight: 600, color: 'var(--clr-text-muted)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Loader2 size={13} className="animate-spin" /> Loading invoice…
        </div>
      )}

      {loadError && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          fontSize: 12.5, fontWeight: 600, color: '#B91C1C',
        }}>
          {loadError}
        </div>
      )}

      {/* Fixed side pop-up (top-right, below the header) rather than an
          inline banner in the page flow — "Save as Draft"/"Generate
          Invoice" sit at the bottom of a long form, so a confirmation
          that only appeared inline up here could go unnoticed without
          scrolling back up. Sits below the sticky top nav (80px) rather
          than centered over it, so it never overlaps the header. */}
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

      <div className="main-grid">
        {/* ── LEFT: Form ──────────────────────────────── */}
        <div style={{
          minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16,
          pointerEvents: isViewMode ? 'none' : undefined,
          opacity: isViewMode ? 0.7 : 1,
        }}>
          <Card title="Customer Details" icon={<User size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Field
                id="invoice-customerName" label="Customer Name" required value={customer.customerName}
                onChange={e => patchCustomer({ customerName: e.target.value })}
                onBlur={() => markTouched('customerName')} error={shownError('customerName')}
                placeholder="Jane Doe" maxLength={100}
              />
              <Field
                id="invoice-companyName" label="Company Name" value={customer.companyName}
                onChange={e => patchCustomer({ companyName: e.target.value })} placeholder="Acme Pvt. Ltd."
                maxLength={100}
              />
              <Field
                id="invoice-email" label="Email" type="email" value={customer.email}
                onChange={e => patchCustomer({ email: e.target.value })}
                onBlur={() => markTouched('email')} error={shownError('email')}
                placeholder="jane@acme.com"
              />
              <Field
                id="invoice-phone" label="Phone" value={customer.phone}
                onChange={e => patchCustomer({ phone: e.target.value })}
                onBlur={() => markTouched('phone')} error={shownError('phone')}
                placeholder="9876543210"
              />
              <Field
                id="invoice-gstin" label="GSTIN" value={customer.gstin}
                onChange={e => patchCustomer({ gstin: e.target.value })}
                onBlur={() => markTouched('gstin')} error={shownError('gstin')}
                placeholder="22AAAAA0000A1Z5"
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <TextAreaField
                  id="invoice-billingAddress" label="Billing Address" value={customer.billingAddress}
                  onChange={e => patchCustomer({ billingAddress: e.target.value })} placeholder="Street, City, State - PIN"
                  maxLength={300}
                />
              </div>
            </div>
          </Card>

          <Card title="Invoice Details" icon={<ClipboardList size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Field
                id="invoice-number" label="Invoice Number" value={invoiceNumber ?? 'Will be assigned on save'} readOnly
                hint={invoiceNumber ? 'Assigned automatically — read-only' : 'Auto-generated on save'}
                style={{ background: 'var(--clr-bg)', color: 'var(--clr-text-muted)', cursor: 'not-allowed' }}
              />
              <Field
                id="invoice-invoiceDate" label="Invoice Date" type="date" value={invoice.invoiceDate}
                onChange={e => patchInvoice({ invoiceDate: e.target.value })}
              />
              <Field
                id="invoice-dueDate" label="Due Date" type="date" value={invoice.dueDate}
                onChange={e => patchInvoice({ dueDate: e.target.value })}
                onBlur={() => markTouched('dueDate')} error={shownError('dueDate')}
              />
              <SelectField id="invoice-paymentTerms" label="Payment Terms" value={invoice.paymentTerms} onChange={e => patchInvoice({ paymentTerms: e.target.value as InvoiceDetails['paymentTerms'] })}>
                {PAYMENT_TERMS.map(term => <option key={term} value={term}>{term}</option>)}
              </SelectField>
              <SelectField id="invoice-currency" label="Currency" value={invoice.currency} onChange={e => patchInvoice({ currency: e.target.value as CurrencyCode })}>
                {CURRENCY_CODES.map(code => <option key={code} value={code}>{code} — {CURRENCY_META[code].label}</option>)}
              </SelectField>
              <SelectField id="invoice-status" label="Invoice Status" value={invoice.status} onChange={e => patchInvoice({ status: e.target.value as InvoiceStatus })}>
                {INVOICE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </SelectField>
            </div>
          </Card>

          <Card title="Items" icon={<ListChecks size={13} />} bodyStyle={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--clr-bg)' }}>
                    {['Description', 'Qty', 'Unit Price', 'Tax %', 'Amount', ''].map((h, i) => (
                      <th key={h || 'actions'} scope="col" style={{
                        textAlign: i === 0 ? 'left' : i === 5 ? 'center' : 'right',
                        padding: '11px 14px', fontSize: 10.5, fontWeight: 700, color: 'var(--clr-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--clr-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      currency={invoice.currency}
                      removeDisabled={items.length <= 1}
                      errors={shownItemError(item.id)}
                      onChange={patch => patchItem(item.id, patch)}
                      onBlurField={field => markItemTouched(item.id, field)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={addItem} className="btn btn-secondary" style={{ fontSize: 12 }}>
                <Plus size={13} /> Add Item
              </button>
              {(submitAttempted && formErrors.items) && <FieldError message={formErrors.items} />}
            </div>
          </Card>

          <Card title="Summary" icon={<Calculator size={13} />}>
            <div style={{ maxWidth: 360, marginLeft: 'auto', display: 'flex', flexDirection: 'column' }}>
              <SummaryRow label="Subtotal" value={fmt(totals.subtotal)} />
              <div style={{ padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="invoice-discount" style={{ fontSize: 12, fontWeight: 500, color: 'var(--clr-text-muted)' }}>Discount</label>
                  <input
                    id="invoice-discount"
                    type="number" min={0} value={discount}
                    aria-invalid={!!shownError('discount')}
                    aria-describedby={shownError('discount') ? 'invoice-discount-error' : undefined}
                    onChange={e => setDiscount(Number(e.target.value))}
                    onBlur={() => markTouched('discount')}
                    style={{
                      width: 120, padding: '5px 9px', textAlign: 'right', borderRadius: 6, fontSize: 12.5,
                      fontFamily: 'inherit', color: 'var(--clr-text)',
                      border: shownError('discount') ? '1.5px solid #FCA5A5' : '1.5px solid var(--clr-border)',
                      boxShadow: shownError('discount') ? '0 0 0 3px rgba(220,38,38,0.10)' : undefined,
                    }}
                  />
                </div>
                {shownError('discount') && <div style={{ textAlign: 'right' }}><FieldError id="invoice-discount-error" message={shownError('discount')} /></div>}
              </div>
              <SummaryRow label="Taxable Amount" value={fmt(totals.taxableAmount)} />
              <SummaryRow label="CGST" value={fmt(totals.cgst)} />
              <SummaryRow label="SGST" value={fmt(totals.sgst)} />
              <SummaryRow label="Round Off" value={fmt(totals.roundOff)} />
              <SummaryRow label="Grand Total" value={fmt(totals.grandTotal)} emphasis />
            </div>
          </Card>

          <Card title="Notes & Terms" icon={<FileText size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <TextAreaField id="invoice-notes" label="Notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} />
              <TextAreaField id="invoice-terms" label="Terms & Conditions" value={terms} onChange={e => setTerms(e.target.value)} maxLength={1000} />
            </div>
          </Card>

          {!isViewMode && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleClear} disabled={saving} className="btn btn-secondary" style={{ fontSize: 12.5 }}>
                <RotateCcw size={13} /> Clear
              </button>
              <button type="button" onClick={handleSaveDraft} disabled={saving} className="btn btn-secondary" style={{ fontSize: 12.5 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save as Draft
              </button>
              <button type="button" onClick={handleGenerate} disabled={saving} className="btn btn-dark" style={{ fontSize: 12.5 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <FileCheck2 size={13} />} {savedId ? 'Update Invoice' : 'Generate Invoice'}
              </button>
            </div>
          )}
        </div>

        {/* View mode's own action row — rendered outside the locked
            left column (not just visually hidden inside it) so it's
            never affected by that column's pointer-events: none. */}
        {isViewMode && (
          <div style={{ gridColumn: '1 / 2', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setMode('edit')} className="btn btn-dark" style={{ fontSize: 12.5 }}>
              <Pencil size={13} /> Edit Invoice
            </button>
          </div>
        )}

        {/* ── RIGHT: Live Preview ─────────────────────── */}
        <aside className="preview-panel animate-fade-in-up" style={{ animationDelay: '80ms', minWidth: 0 }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--clr-text)', margin: 0, letterSpacing: '-0.02em' }}>Live Preview</p>
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', margin: '2px 0 0' }}>A4 · Updates instantly</p>
          </div>

          <PreviewToolbar
            zoomPct={Math.round(previewScale * 100)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetZoom={handleSetZoom}
            onFitToScreen={handleFitToScreen}
            onPrint={handlePrint}
            onDownload={handleDownload}
            downloading={downloading}
          />

          <div className="preview-shell" ref={shellRef}>
            {loadingRecord ? (
              <div className="preview-empty-state">
                <div className="preview-empty-state-icon"><Loader2 size={22} className="animate-spin" /></div>
                <h2>Loading invoice…</h2>
                <p>Fetching the saved invoice — the preview will appear here as soon as it's ready.</p>
              </div>
            ) : items.some(i => i.description.trim()) || customer.customerName.trim() ? (
              <div style={{
                width: '100%', display: 'flex', justifyContent: 'center',
                minHeight: `${Math.round(A4_PX_HEIGHT * previewScale)}px`, padding: '28px 0',
              }}>
                <div style={{
                  width: A4_PX_WIDTH, transformOrigin: 'top center', transform: `scale(${previewScale})`,
                  transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                  flexShrink: 0, boxShadow: '0 12px 40px rgba(15, 23, 42, 0.28), 0 2px 8px rgba(15, 23, 42, 0.12)',
                  borderRadius: 3, height: 'fit-content',
                }}>
                  <InvoicePreview
                    customer={customer}
                    invoice={invoice}
                    invoiceNumber={invoiceNumber ?? 'Pending — assigned on save'}
                    items={items}
                    totals={totals}
                    notes={notes}
                    terms={terms}
                  />
                </div>
              </div>
            ) : (
              <div className="preview-empty-state">
                <div className="preview-empty-state-icon"><FileText size={22} /></div>
                <h2>Nothing to preview yet</h2>
                <p>Add a customer name or an item description and the invoice preview will appear here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Off-screen PDF/print render target (Sprint 5) — same relationship
          App.tsx's own <SalarySlipPDF pdfRef={pdfRef} /> mount has to that
          module: always mounted, never visible on screen, captured by
          generateInvoicePdf.ts for Download/Open PDF/Email, and made the
          browser's print target by the .invoice-printing class (see
          index.css) for Print Invoice. */}
      <div className="finance-pdf-offscreen" aria-hidden="true">
        <InvoicePdf
          customer={customer}
          invoice={invoice}
          invoiceNumber={invoiceNumber ?? 'PENDING'}
          items={items}
          totals={totals}
          notes={notes}
          terms={terms}
          pdfRef={pdfRef}
        />
      </div>

      <EmailInvoiceModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        invoiceNumber={invoiceNumber ?? ''}
        customerEmail={customer.email}
        companyName={brand.companyName}
        sending={emailSending}
        onSend={handleSendEmail}
      />
    </div>
  );
}
