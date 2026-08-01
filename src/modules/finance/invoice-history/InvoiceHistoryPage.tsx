import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, Pencil, Copy, Trash2, History, ChevronLeft, ChevronRight, Loader2,
  Download, Printer, Mail, ExternalLink, Cloud, X, MoreHorizontal,
} from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge, BadgeTone } from '../../../components/ui/StatusBadge';
import { TableToolbar, SearchInput } from '../../../components/ui/TableToolbar';
import { formatAmount } from '../../../utils/currencyService';
import { loadCompanySettings } from '../../../utils/companySettingsStore';
import { loadInvoiceSettings } from '../utils/invoiceSettingsStore';
import { Invoice, INVOICE_STATUSES, InvoiceStatus } from '../types';
import { computeInvoiceTotals } from '../utils';
import { ApiError, createInvoice, emailInvoice, getInvoice } from '../services/invoiceApi';
import { useInvoices, InvoiceSort } from '../hooks/useInvoices';
import { InvoicePdf } from '../invoice-generator/pdf/InvoicePdf';
import { generateInvoicePdf } from '../invoice-generator/pdf/generateInvoicePdf';
import { EmailInvoiceModal } from '../invoice-generator/components/EmailInvoiceModal';

/** Overdue reads as 'danger' (most urgent — needs action now); Partially
    Paid as 'warning' (in progress, distinct from Overdue); Cancelled
    shares Draft's 'neutral' tone — both are inactive/non-actionable
    states, same convention Stripe/QuickBooks use for void vs. draft. */
const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  Draft: 'neutral', Sent: 'info', Paid: 'success', 'Partially Paid': 'warning', Overdue: 'danger', Cancelled: 'neutral',
};

const SORT_OPTIONS: { value: InvoiceSort; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'amount_desc', label: 'Amount: High to Low' },
  { value: 'amount_asc', label: 'Amount: Low to High' },
];

interface Props {
  /** Invoice History has no built-in way to "navigate" to the
      Generator (no URL router in this app) — App.tsx passes this
      callback down and lifts the resulting { id, mode, invoice } request
      to InvoiceGeneratorPage itself (see InvoiceGeneratorPage's
      InvoiceOpenRequest prop). The optional third argument is the row's
      already-fetched Invoice — always passed here — so the Generator
      can skip its own GET /invoices/:id and open instantly instead of
      showing "Loading invoice…" for data History already had. */
  onOpenInvoice: (id: string, mode: 'edit' | 'view', invoice?: Invoice) => void;
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  padding: '8px 12px', border: 'none', background: 'transparent',
  fontSize: 12.5, fontWeight: 600, color: 'var(--clr-text)',
  textAlign: 'left', cursor: 'pointer', borderRadius: 8,
};

/** One row of the per-invoice "More actions" menu — same visual
    language as ExportShareDropdown.tsx's menu items, reused here so the
    Actions column's row of up to 9 icons (Preview/Edit/Download/Print/
    Email/Open PDF/Drive/Duplicate/Delete) collapses down to just
    Preview, Edit and a single "More" trigger. */
function MenuItem({ icon: Icon, label, onClick, disabled, danger }: {
  icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      style={{ ...menuItemStyle, color: danger ? '#DC2626' : menuItemStyle.color, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--clr-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

/** Finance module — Invoice History (Sprint 4). Server-side search/
    filter/sort/pagination via useInvoices (mirrors the pattern
    salaryHistory.service.js already established on the backend);
    unlike SalaryHistoryPage, this page owns and fetches its own data
    rather than being handed a pre-fetched array from App.tsx, keeping
    the Invoice module fully self-contained. */
export function InvoiceHistoryPage({ onOpenInvoice }: Props) {
  const {
    items, loading, error, page, totalPages, total, setPage,
    q, setQ, status, setStatus, dateFrom, dateTo, setDateRange,
    sort, setSort, refresh, removeInvoice,
  } = useInvoices();

  // Part 9 — memoized once per mount rather than re-reading/parsing
  // localStorage on every render just for the email modal's prop.
  const brand = useMemo(() => loadCompanySettings(), []);

  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* Per-row "More actions" menu — only one row's menu is ever open at a
     time, so a single id + a single ref (attached only to whichever
     row's menu is currently rendered) is enough; no per-row ref array
     needed. */
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  /* Sprint 5, Part 7 — Download/Print/Email/Open PDF from a History
     row. Unlike InvoiceGeneratorPage (which always has a live
     off-screen InvoicePdf mounted for the invoice currently being
     edited), History has no single "current" invoice — so it mounts
     one on demand for whichever row's action was just clicked, waits
     a couple of frames for it to render, captures/prints it, then
     unmounts it. `items` from useInvoices already carries each row's
     full items/customer/etc. (see invoiceApi.ts's fromApiRecord), so
     no extra fetch is needed before rendering it. */
  const [pdfTargetInvoice, setPdfTargetInvoice] = useState<Invoice | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [emailTargetInvoice, setEmailTargetInvoice] = useState<Invoice | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  /* Preview modal — clicking "Preview" used to send the user all the
     way to the Invoice Generator tab in read-only 'view' mode just to
     look at the PDF; this renders the same on-demand PDF in place, in a
     modal, so previewing an invoice never leaves Invoice History. */
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  async function withRowPdf<T>(invoice: Invoice, action: (result: Awaited<ReturnType<typeof generateInvoicePdf>>) => Promise<T> | T): Promise<T> {
    setPdfTargetInvoice(invoice);
    // Two frames: one for React to commit the off-screen node, one for
    // the browser to have laid it out before html2canvas reads it.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    try {
      if (!pdfRef.current) throw new Error('PDF render target is not ready');
      const result = await generateInvoicePdf(pdfRef.current, invoice.invoiceNumber);
      return await action(result);
    } finally {
      setPdfTargetInvoice(null);
    }
  }

  const handleDownloadRow = async (invoice: Invoice) => {
    setBusyId(invoice.id);
    try {
      await withRowPdf(invoice, ({ pdf, fileName }) => { pdf.save(fileName); });
    } catch (err) {
      console.error('[invoice] PDF download failed:', err);
      showNotice('Failed to generate PDF. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenPdfRow = async (invoice: Invoice) => {
    setBusyId(invoice.id);
    try {
      await withRowPdf(invoice, ({ blob }) => { window.open(URL.createObjectURL(blob), '_blank', 'noopener'); });
    } catch (err) {
      console.error('[invoice] PDF open failed:', err);
      showNotice('Failed to generate PDF. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePreviewRow = async (invoice: Invoice) => {
    setBusyId(invoice.id);
    setPreviewInvoice(invoice);
    setPreviewUrl(null);
    try {
      await withRowPdf(invoice, ({ blob }) => {
        setPreviewUrl(URL.createObjectURL(blob));
      });
    } catch (err) {
      console.error('[invoice] Preview failed:', err);
      showNotice('Failed to generate PDF preview. Please try again.');
      setPreviewInvoice(null);
    } finally {
      setBusyId(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewInvoice(null);
    setPreviewUrl(null);
  };

  /** Print doesn't need html2canvas at all — it just needs the
      off-screen node rendered with this row's data before the browser
      prints it, same .invoice-printing gate InvoiceGeneratorPage uses. */
  const handlePrintRow = async (invoice: Invoice) => {
    setPdfTargetInvoice(invoice);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const cleanup = () => {
      document.body.classList.remove('invoice-printing');
      window.removeEventListener('afterprint', cleanup);
      setPdfTargetInvoice(null);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.classList.add('invoice-printing');
    window.print();
  };

  const handleOpenDriveRow = (invoice: Invoice) => {
    if (invoice.driveFileUrl) window.open(invoice.driveFileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmailRow = async (to: string, subject: string) => {
    if (!emailTargetInvoice) return;
    setEmailSending(true);
    try {
      await withRowPdf(emailTargetInvoice, async ({ blob }) => {
        await emailInvoice(emailTargetInvoice.id, { recipientEmail: to, subject, companyName: brand.companyName, pdfBlob: blob });
      });
      setEmailTargetInvoice(null);
      refresh();
      showNotice(`Invoice emailed to ${to}.`);
    } catch (err) {
      console.error('[invoice] Email send failed:', err);
      showNotice(err instanceof ApiError ? err.message : 'Failed to send email.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await removeInvoice(id);
      showNotice(`Invoice ${invoiceNumber} deleted.`);
    } catch (err) {
      console.error('[invoice] Delete failed:', err);
      showNotice(err instanceof ApiError ? err.message : 'Failed to delete invoice.');
    } finally {
      setBusyId(null);
    }
  };

  /** Part 8 — Duplicate is a frontend GET-then-POST: fetch the full
      record, drop id/invoiceNumber/timestamps, and let createInvoice's
      normal flow assign a fresh sequential number. No dedicated
      backend endpoint, so the API surface stays exactly the 5
      explicitly-specified CRUD routes. */
  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      const source = await getInvoice(id);
      const { id: _id, invoiceNumber: _invoiceNumber, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
      const copy = await createInvoice({ ...rest, status: 'Draft' }, loadInvoiceSettings().invoicePrefix);
      refresh();
      showNotice(`Duplicated as ${copy.invoiceNumber}.`);
    } catch (err) {
      console.error('[invoice] Duplicate failed:', err);
      showNotice(err instanceof ApiError ? err.message : 'Failed to duplicate invoice.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <Breadcrumb items={[{ label: 'Finance' }, { label: 'Invoice History' }]} />
      <PageHeader title="Invoice History" description="View and manage previously generated invoices." />

      {notice && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: '#F0FDFA', border: '1px solid #99F6E4',
          fontSize: 12.5, fontWeight: 600, color: '#0F766E',
        }}>
          {notice}
        </div>
      )}

      <TableToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search by invoice number, customer or company…" />
        <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus | '')} className="field" style={{ flex: '0 1 150px' }}>
          <option value="">All Statuses</option>
          {INVOICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="date" value={dateFrom} onChange={e => setDateRange(e.target.value, dateTo)}
          className="field" title="From date" style={{ flex: '0 1 150px' }}
        />
        <input
          type="date" value={dateTo} onChange={e => setDateRange(dateFrom, e.target.value)}
          className="field" title="To date" style={{ flex: '0 1 150px' }}
        />
        <select value={sort} onChange={e => setSort(e.target.value as InvoiceSort)} className="field" style={{ flex: '0 1 190px' }}>
          {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </TableToolbar>

      {error && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          fontSize: 12.5, fontWeight: 600, color: '#B91C1C',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="page-loading">
          <Loader2 size={16} />
          Loading invoices…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title={total === 0 && !q && !status && !dateFrom && !dateTo ? 'No invoices yet' : 'No invoices match your filters'}
          description={
            total === 0 && !q && !status && !dateFrom && !dateTo
              ? 'Generate an invoice and it will show up here automatically.'
              : 'Try clearing the search or filters above.'
          }
        />
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--clr-bg)' }}>
                    {['Invoice Number', 'Customer', 'Invoice Date', 'Status', 'Currency', 'Grand Total', 'Created Date', 'Actions'].map((h, i) => (
                      <th key={h} scope="col" style={{
                        textAlign: i === 5 ? 'right' : i === 7 ? 'center' : 'left',
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
                  {items.map((invoice) => {
                    const { grandTotal } = computeInvoiceTotals(invoice.items, invoice.discount);
                    const rowBusy = busyId === invoice.id;
                    return (
                      <tr key={invoice.id} className="data-row">
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--clr-text)', whiteSpace: 'nowrap' }}>{invoice.invoiceNumber}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--clr-text)', whiteSpace: 'nowrap' }}>{invoice.customerName || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--clr-text-muted)', whiteSpace: 'nowrap' }}>{invoice.invoiceDate || '—'}</td>
                        <td style={{ padding: '10px 14px' }}><StatusBadge label={invoice.status} tone={STATUS_TONE[invoice.status]} /></td>
                        <td style={{ padding: '10px 14px', color: 'var(--clr-text-muted)' }}>{invoice.currency}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--clr-text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatAmount(grandTotal, invoice.currency)}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--clr-text-muted)', whiteSpace: 'nowrap' }}>{invoice.createdAt ? invoice.createdAt.slice(0, 10) : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'nowrap' }}>
                            <button onClick={() => handlePreviewRow(invoice)} disabled={rowBusy} title="Preview" aria-label={`Preview invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}>
                              {rowBusy && busyId === invoice.id ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                            </button>
                            <button onClick={() => onOpenInvoice(invoice.id, 'edit', invoice)} title="Edit" aria-label={`Edit invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Pencil size={13} /></button>

                            {/* Every other action (Download/Print/Email/
                                Open PDF/Open in Drive/Duplicate/Delete) —
                                tucked behind one "More" trigger instead of
                                7 more standing icons per row. */}
                            <div style={{ position: 'relative' }} ref={openMenuId === invoice.id ? menuRef : undefined}>
                              <button
                                onClick={() => setOpenMenuId(prev => (prev === invoice.id ? null : invoice.id))}
                                disabled={rowBusy}
                                title="More actions"
                                aria-label={`More actions for invoice ${invoice.invoiceNumber}`}
                                aria-haspopup="menu"
                                aria-expanded={openMenuId === invoice.id}
                                className="btn-icon"
                                style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}
                              >
                                <MoreHorizontal size={14} />
                              </button>

                              {openMenuId === invoice.id && (
                                <div
                                  role="menu"
                                  style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                                    width: 210, background: '#fff', border: '1px solid var(--clr-border)',
                                    borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', padding: 6,
                                  }}
                                >
                                  <MenuItem icon={Download} label="Download PDF" onClick={() => { setOpenMenuId(null); handleDownloadRow(invoice); }} />
                                  <MenuItem icon={Printer} label="Print" onClick={() => { setOpenMenuId(null); handlePrintRow(invoice); }} />
                                  <MenuItem
                                    icon={Mail}
                                    label={invoice.email ? 'Email Invoice' : 'Email (no address on file)'}
                                    disabled={!invoice.email}
                                    onClick={() => { setOpenMenuId(null); setEmailTargetInvoice(invoice); }}
                                  />
                                  <MenuItem icon={ExternalLink} label="Open PDF in New Tab" onClick={() => { setOpenMenuId(null); handleOpenPdfRow(invoice); }} />
                                  <MenuItem
                                    icon={Cloud}
                                    label={invoice.driveFileUrl ? 'Open in Google Drive' : 'Not on Google Drive yet'}
                                    disabled={!invoice.driveFileUrl}
                                    onClick={() => { setOpenMenuId(null); handleOpenDriveRow(invoice); }}
                                  />
                                  <MenuItem icon={Copy} label="Duplicate" onClick={() => { setOpenMenuId(null); handleDuplicate(invoice.id); }} />
                                  <div style={{ height: 1, background: 'var(--clr-border)', margin: '4px 0' }} />
                                  <MenuItem
                                    icon={Trash2}
                                    label="Delete"
                                    danger
                                    onClick={() => { setOpenMenuId(null); handleDelete(invoice.id, invoice.invoiceNumber); }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 22 }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-icon"
                style={{ border: '1px solid var(--clr-border)', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                Page {page} of {totalPages} · {total} invoice{total === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-icon"
                style={{ border: '1px solid var(--clr-border)', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* On-demand off-screen PDF/print render target — see withRowPdf
          above for why this mounts a specific row's invoice rather
          than the "current" one InvoiceGeneratorPage always has. */}
      {pdfTargetInvoice && (
        <div className="finance-pdf-offscreen" aria-hidden="true">
          <InvoicePdf
            customer={{
              customerName: pdfTargetInvoice.customerName, companyName: pdfTargetInvoice.companyName,
              email: pdfTargetInvoice.email, phone: pdfTargetInvoice.phone,
              gstin: pdfTargetInvoice.gstin, billingAddress: pdfTargetInvoice.billingAddress,
            }}
            invoice={{
              invoiceDate: pdfTargetInvoice.invoiceDate, dueDate: pdfTargetInvoice.dueDate,
              paymentTerms: pdfTargetInvoice.paymentTerms, currency: pdfTargetInvoice.currency,
              status: pdfTargetInvoice.status,
            }}
            invoiceNumber={pdfTargetInvoice.invoiceNumber}
            items={pdfTargetInvoice.items}
            totals={computeInvoiceTotals(pdfTargetInvoice.items, pdfTargetInvoice.discount)}
            notes={pdfTargetInvoice.notes}
            terms={pdfTargetInvoice.termsAndConditions}
            pdfRef={pdfRef}
          />
        </div>
      )}

      <EmailInvoiceModal
        isOpen={!!emailTargetInvoice}
        onClose={() => setEmailTargetInvoice(null)}
        invoiceNumber={emailTargetInvoice?.invoiceNumber ?? ''}
        customerEmail={emailTargetInvoice?.email ?? ''}
        companyName={brand.companyName}
        sending={emailSending}
        onSend={handleSendEmailRow}
      />

      {previewInvoice && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={closePreview}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 780, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--clr-text)' }}>
                <Eye size={15} style={{ color: 'var(--arna-accent)' }} />
                Invoice {previewInvoice.invoiceNumber}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => handleDownloadRow(previewInvoice)} title="Download PDF" aria-label="Download PDF" className="btn-icon" style={{ border: 'none' }}><Download size={14} /></button>
                <button onClick={() => handlePrintRow(previewInvoice)} title="Print" aria-label="Print" className="btn-icon" style={{ border: 'none' }}><Printer size={14} /></button>
                <button onClick={() => handleOpenPdfRow(previewInvoice)} title="Open in new tab" aria-label="Open in new tab" className="btn-icon" style={{ border: 'none' }}><ExternalLink size={14} /></button>
                <button
                  onClick={() => { onOpenInvoice(previewInvoice.id, 'edit', previewInvoice); closePreview(); }}
                  title="Edit"
                  aria-label="Edit invoice"
                  className="btn-icon"
                  style={{ border: 'none' }}
                >
                  <Pencil size={14} />
                </button>
                <div style={{ width: 1, height: 20, background: 'var(--clr-border)', margin: '0 2px' }} />
                <button onClick={closePreview} title="Close" aria-label="Close preview" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
              {previewUrl ? (
                <iframe src={previewUrl} title={`Invoice ${previewInvoice.invoiceNumber} preview`} style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  <Loader2 size={16} className="animate-spin" />
                  Generating preview…
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
