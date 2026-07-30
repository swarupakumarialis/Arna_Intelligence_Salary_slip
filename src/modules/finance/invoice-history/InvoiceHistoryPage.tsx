import React, { useMemo, useRef, useState } from 'react';
import {
  Eye, Pencil, Copy, Trash2, History, ChevronLeft, ChevronRight, Loader2,
  Download, Printer, Mail, ExternalLink, Cloud,
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
      callback down and lifts the resulting { id, mode } request to
      InvoiceGeneratorPage itself (see InvoiceGeneratorPage's
      InvoiceOpenRequest prop). */
  onOpenInvoice: (id: string, mode: 'edit' | 'view') => void;
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
                          <div style={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'nowrap' }}>
                            <button onClick={() => onOpenInvoice(invoice.id, 'view')} title="View" aria-label={`View invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Eye size={13} /></button>
                            <button onClick={() => onOpenInvoice(invoice.id, 'edit')} title="Edit" aria-label={`Edit invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Pencil size={13} /></button>
                            <button onClick={() => handleDownloadRow(invoice)} disabled={rowBusy} title="Download PDF" aria-label={`Download PDF for invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}>
                              {rowBusy && busyId === invoice.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            </button>
                            <button onClick={() => handlePrintRow(invoice)} disabled={rowBusy} title="Print" aria-label={`Print invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}><Printer size={13} /></button>
                            <button
                              onClick={() => setEmailTargetInvoice(invoice)}
                              disabled={rowBusy || !invoice.email}
                              title={invoice.email ? 'Email Invoice' : 'No customer email on file — add one first'}
                              aria-label={invoice.email ? `Email invoice ${invoice.invoiceNumber}` : `Email invoice ${invoice.invoiceNumber} — no customer email on file`}
                              className="btn-icon"
                              style={{ border: 'none', cursor: (rowBusy || !invoice.email) ? 'not-allowed' : 'pointer', opacity: invoice.email ? 1 : 0.35 }}
                            >
                              <Mail size={13} />
                            </button>
                            <button onClick={() => handleOpenPdfRow(invoice)} disabled={rowBusy} title="Open PDF" aria-label={`Open PDF for invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}><ExternalLink size={13} /></button>
                            <button
                              onClick={() => handleOpenDriveRow(invoice)}
                              disabled={!invoice.driveFileUrl}
                              title={invoice.driveFileUrl ? 'Open in Google Drive' : 'Not uploaded to Google Drive yet'}
                              aria-label={invoice.driveFileUrl ? `Open invoice ${invoice.invoiceNumber} in Google Drive` : `Invoice ${invoice.invoiceNumber} not uploaded to Google Drive yet`}
                              className="btn-icon"
                              style={{ border: 'none', cursor: invoice.driveFileUrl ? 'pointer' : 'not-allowed', opacity: invoice.driveFileUrl ? 1 : 0.35 }}
                            >
                              <Cloud size={13} />
                            </button>
                            <button onClick={() => handleDuplicate(invoice.id)} disabled={rowBusy} title="Duplicate" aria-label={`Duplicate invoice ${invoice.invoiceNumber}`} className="btn-icon" style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}>
                              {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                            </button>
                            <button
                              onClick={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                              disabled={rowBusy}
                              title="Delete"
                              aria-label={`Delete invoice ${invoice.invoiceNumber}`}
                              className="btn-icon"
                              style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-danger)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
                            >
                              <Trash2 size={13} />
                            </button>
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
    </div>
  );
}
