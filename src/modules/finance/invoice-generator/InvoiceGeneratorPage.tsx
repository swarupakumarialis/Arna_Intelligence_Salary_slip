import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Save, RotateCcw, FileCheck2, User, ClipboardList, ListChecks, Calculator, FileText, Pencil, Loader2,
} from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { Card } from '../../../components/ui/Card';
import { CURRENCY_CODES, CURRENCY_META, CurrencyCode, formatAmount } from '../../../utils/currencyService';
import {
  CustomerDetails, InvoiceDetails, InvoiceItem, InvoiceStatus, PAYMENT_TERMS, INVOICE_STATUSES,
} from '../types';
import { computeInvoiceTotals, createBlankInvoiceItem, todayIso } from '../utils';
import { ApiError, createInvoice, getInvoice, updateInvoice } from '../services/invoiceApi';
import { InvoicePreview } from './components/InvoicePreview';
import { PreviewToolbar } from './components/PreviewToolbar';

/** What Invoice History asks the Generator to open (Sprint 4). There is
    no URL router in this app (see App.tsx's SidebarKey/activePage
    state), so "navigate to invoice X in edit/view mode" has to be
    passed as an explicit prop from App.tsx rather than a route param —
    App.tsx lifts just this one small piece of state, not the whole
    Invoice module, keeping the module itself self-contained. */
export interface InvoiceOpenRequest {
  id: string;
  mode: 'edit' | 'view';
}

interface Props {
  openRequest?: InvoiceOpenRequest | null;
  onOpenRequestHandled?: () => void;
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

function defaultInvoiceDetails(): InvoiceDetails {
  return { invoiceDate: todayIso(), dueDate: '', paymentTerms: 'Due on Receipt', currency: 'INR', status: 'Draft' };
}

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

function SelectField({
  label, children, ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select {...props} className="field">{children}</select>
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

interface ItemRowProps {
  item: InvoiceItem;
  index: number;
  currency: CurrencyCode;
  removeDisabled: boolean;
  onChange: (patch: Partial<InvoiceItem>) => void;
  onRemove: () => void;
}

/** One editable row of the Items table. Amount is always derived
    (quantity × unitPrice), never itself an input — matches the
    "Amount auto-calculates" requirement literally: there is no
    onChange path that can set it directly. Declared as React.FC (not
    a plain function) — a plain `function ItemRow(...)` declaration
    tripped a TS/JSX inference quirk in this project (see Sprint 2). */
const ItemRow: React.FC<ItemRowProps> = ({ item, index, currency, removeDisabled, onChange, onRemove }) => {
  const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const cellInputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 9px', background: '#f9fafb', border: '1.5px solid transparent',
    borderRadius: 7, fontSize: 12.5, color: 'var(--clr-text)', fontFamily: 'inherit', outline: 'none',
    transition: 'all 150ms',
  };
  const onFocusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.background = '#fff';
    e.currentTarget.style.borderColor = 'var(--brand-primary)';
    e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-primary) 12%, transparent)';
  };
  const onBlurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.background = '#f9fafb';
    e.currentTarget.style.borderColor = 'transparent';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <tr className="data-row">
      <td style={{ padding: '8px 10px', minWidth: 220 }}>
        <input
          type="text" placeholder={`Item ${index + 1} description`} value={item.description}
          onChange={e => onChange({ description: e.target.value })}
          onFocus={onFocusStyle} onBlur={onBlurStyle}
          style={cellInputStyle}
        />
      </td>
      <td style={{ padding: '8px 10px', width: 90 }}>
        <input
          type="number" min={0} value={item.quantity}
          onChange={e => onChange({ quantity: Number(e.target.value) })}
          onFocus={onFocusStyle} onBlur={onBlurStyle}
          style={{ ...cellInputStyle, textAlign: 'right' }}
        />
      </td>
      <td style={{ padding: '8px 10px', width: 130 }}>
        <input
          type="number" min={0} value={item.unitPrice}
          onChange={e => onChange({ unitPrice: Number(e.target.value) })}
          onFocus={onFocusStyle} onBlur={onBlurStyle}
          style={{ ...cellInputStyle, textAlign: 'right' }}
        />
      </td>
      <td style={{ padding: '8px 10px', width: 90 }}>
        <input
          type="number" min={0} max={100} value={item.taxPercent}
          onChange={e => onChange({ taxPercent: Number(e.target.value) })}
          onFocus={onFocusStyle} onBlur={onBlurStyle}
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
          className="btn-icon" title="Remove item"
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

/** Invoice Generator — Sprint 2 form, Sprint 3 live preview, Sprint 4
    real persistence. Create/Edit/View all share this one component and
    this one piece of state (no separate "view" component/state copy):
    View mode just locks the form visually and swaps the footer actions
    for a single "Edit Invoice" button; Edit mode is Create's same
    save flow, routed to PUT instead of POST because `savedId` is set. */
export function InvoiceGeneratorPage({ openRequest, onOpenRequestHandled }: Props = {}) {
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomerDetails);
  const [invoice, setInvoice] = useState<InvoiceDetails>(defaultInvoiceDetails);
  const [items, setItems] = useState<InvoiceItem[]>([createBlankInvoiceItem()]);
  const [discount, setDiscount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('create');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [zoomMode, setZoomMode] = useState<'fixed' | 'fit'>('fixed');
  const [previewScale, setPreviewScale] = useState(0.75);
  const shellRef = useRef<HTMLDivElement>(null);

  const patchCustomer = (patch: Partial<CustomerDetails>) => setCustomer(prev => ({ ...prev, ...patch }));
  const patchInvoice = (patch: Partial<InvoiceDetails>) => setInvoice(prev => ({ ...prev, ...patch }));

  const patchItem = (id: string, patch: Partial<InvoiceItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };
  const addItem = () => setItems(prev => [...prev, createBlankInvoiceItem()]);
  const removeItem = (id: string) => setItems(prev => (prev.length > 1 ? prev.filter(item => item.id !== id) : prev));

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleClear = () => {
    setCustomer(emptyCustomerDetails());
    setInvoice(defaultInvoiceDetails());
    setItems([createBlankInvoiceItem()]);
    setDiscount(0);
    setMode('create');
    setSavedId(null);
    setInvoiceNumber(null);
    setLoadError(null);
    showNotice('Form cleared.');
  };

  /* Sprint 4 Part 6/7 — View/Edit: Invoice History hands this page an
     { id, mode } request (see InvoiceOpenRequest above); it has no
     other way to say "open this saved invoice". Consumed exactly once
     via onOpenRequestHandled, which the parent uses to null the
     request back out so re-render/re-navigation doesn't refetch. */
  useEffect(() => {
    if (!openRequest) return;
    let cancelled = false;
    setLoadingRecord(true);
    setLoadError(null);
    getInvoice(openRequest.id)
      .then((inv) => {
        if (cancelled) return;
        setCustomer({
          customerName: inv.customerName, companyName: inv.companyName, email: inv.email,
          phone: inv.phone, gstin: inv.gstin, billingAddress: inv.billingAddress,
        });
        setInvoice({
          invoiceDate: inv.invoiceDate, dueDate: inv.dueDate, paymentTerms: inv.paymentTerms,
          currency: inv.currency, status: inv.status,
        });
        setItems(inv.items.length ? inv.items : [createBlankInvoiceItem()]);
        setDiscount(inv.discount);
        setSavedId(inv.id);
        setInvoiceNumber(inv.invoiceNumber);
        setMode(openRequest.mode);
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

  function validateInvoice(): string | null {
    if (!customer.customerName.trim()) return 'Customer Name is required.';
    if (!items.some(item => item.description.trim() && Number(item.quantity) > 0)) {
      return 'Add at least one item with a description and quantity.';
    }
    return null;
  }

  /** Shared by both footer actions — the only difference between
      "Save as Draft" and "Generate Invoice" is which status gets
      saved; both POST when there's no savedId yet and PUT once one
      exists, so repeated draft saves update the same document instead
      of creating duplicates (Part 4). */
  const persistInvoice = async (statusOverride?: InvoiceStatus) => {
    const validationError = validateInvoice();
    if (validationError) {
      showNotice(validationError);
      return;
    }
    setSaving(true);
    const payload = { ...customer, ...invoice, status: statusOverride ?? invoice.status, items, discount, notes: '' };
    try {
      const saved = savedId ? await updateInvoice(savedId, payload) : await createInvoice(payload);
      setSavedId(saved.id);
      setInvoiceNumber(saved.invoiceNumber);
      if (statusOverride) patchInvoice({ status: statusOverride });
      setMode('edit');
      showNotice(`Invoice ${saved.invoiceNumber} ${savedId ? 'updated' : 'created'} successfully.`);
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => persistInvoice('Draft');
  const handleGenerate = () => persistInvoice();

  const totals = useMemo(() => computeInvoiceTotals(items, discount), [items, discount]);
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

      {notice && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: '#F0FDFA', border: '1px solid #99F6E4',
          fontSize: 12.5, fontWeight: 600, color: '#0F766E',
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
              <Field label="Customer Name" value={customer.customerName} onChange={e => patchCustomer({ customerName: e.target.value })} placeholder="Jane Doe" />
              <Field label="Company Name" value={customer.companyName} onChange={e => patchCustomer({ companyName: e.target.value })} placeholder="Acme Pvt. Ltd." />
              <Field label="Email" type="email" value={customer.email} onChange={e => patchCustomer({ email: e.target.value })} placeholder="jane@acme.com" />
              <Field label="Phone" value={customer.phone} onChange={e => patchCustomer({ phone: e.target.value })} placeholder="9876543210" />
              <Field label="GSTIN" value={customer.gstin} onChange={e => patchCustomer({ gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
              <div style={{ gridColumn: '1 / -1' }}>
                <TextAreaField label="Billing Address" value={customer.billingAddress} onChange={e => patchCustomer({ billingAddress: e.target.value })} placeholder="Street, City, State - PIN" />
              </div>
            </div>
          </Card>

          <Card title="Invoice Details" icon={<ClipboardList size={13} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Field
                label="Invoice Number" value={invoiceNumber ?? 'Will be assigned on save'} readOnly
                hint={invoiceNumber ? 'Assigned automatically — read-only' : 'Auto-generated on save'}
                style={{ background: 'var(--clr-bg)', color: 'var(--clr-text-muted)', cursor: 'not-allowed' }}
              />
              <Field label="Invoice Date" type="date" value={invoice.invoiceDate} onChange={e => patchInvoice({ invoiceDate: e.target.value })} />
              <Field label="Due Date" type="date" value={invoice.dueDate} onChange={e => patchInvoice({ dueDate: e.target.value })} />
              <SelectField label="Payment Terms" value={invoice.paymentTerms} onChange={e => patchInvoice({ paymentTerms: e.target.value as InvoiceDetails['paymentTerms'] })}>
                {PAYMENT_TERMS.map(term => <option key={term} value={term}>{term}</option>)}
              </SelectField>
              <SelectField label="Currency" value={invoice.currency} onChange={e => patchInvoice({ currency: e.target.value as CurrencyCode })}>
                {CURRENCY_CODES.map(code => <option key={code} value={code}>{code} — {CURRENCY_META[code].label}</option>)}
              </SelectField>
              <SelectField label="Invoice Status" value={invoice.status} onChange={e => patchInvoice({ status: e.target.value as InvoiceStatus })}>
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
                      <th key={h || 'actions'} style={{
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
                      onChange={patch => patchItem(item.id, patch)}
                      onRemove={() => removeItem(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--clr-border)' }}>
              <button type="button" onClick={addItem} className="btn btn-secondary" style={{ fontSize: 12 }}>
                <Plus size={13} /> Add Item
              </button>
            </div>
          </Card>

          <Card title="Summary" icon={<Calculator size={13} />}>
            <div style={{ maxWidth: 360, marginLeft: 'auto', display: 'flex', flexDirection: 'column' }}>
              <SummaryRow label="Subtotal" value={fmt(totals.subtotal)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--clr-text-muted)' }}>Discount</span>
                <input
                  type="number" min={0} value={discount}
                  onChange={e => setDiscount(Number(e.target.value))}
                  style={{
                    width: 120, padding: '5px 9px', textAlign: 'right', border: '1.5px solid var(--clr-border)',
                    borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', color: 'var(--clr-text)',
                  }}
                />
              </div>
              <SummaryRow label="Taxable Amount" value={fmt(totals.taxableAmount)} />
              <SummaryRow label="CGST" value={fmt(totals.cgst)} />
              <SummaryRow label="SGST" value={fmt(totals.sgst)} />
              <SummaryRow label="Round Off" value={fmt(totals.roundOff)} />
              <SummaryRow label="Grand Total" value={fmt(totals.grandTotal)} emphasis />
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
          />

          <div className="preview-shell" ref={shellRef}>
            {items.some(i => i.description.trim()) || customer.customerName.trim() ? (
              <div style={{
                width: '100%', display: 'flex', justifyContent: 'center',
                minHeight: `${Math.round(A4_PX_HEIGHT * previewScale)}px`, padding: '28px 0',
              }}>
                <div style={{
                  width: A4_PX_WIDTH, transformOrigin: 'top center', transform: `scale(${previewScale})`,
                  flexShrink: 0, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', borderRadius: 3, height: 'fit-content',
                }}>
                  <InvoicePreview
                    customer={customer}
                    invoice={invoice}
                    invoiceNumber={invoiceNumber ?? 'Pending — assigned on save'}
                    items={items}
                    totals={totals}
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
    </div>
  );
}
