import React, { useState } from 'react';
import {
  Eye, Pencil, Copy, Trash2, History, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge, BadgeTone } from '../../../components/ui/StatusBadge';
import { TableToolbar, SearchInput } from '../../../components/ui/TableToolbar';
import { formatAmount } from '../../../utils/currencyService';
import { INVOICE_STATUSES, InvoiceStatus } from '../types';
import { computeInvoiceTotals } from '../utils';
import { ApiError, createInvoice, getInvoice } from '../services/invoiceApi';
import { useInvoices, InvoiceSort } from '../hooks/useInvoices';

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  Draft: 'neutral', Sent: 'info', Paid: 'success', Overdue: 'warning', Cancelled: 'danger',
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

  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await removeInvoice(id);
      showNotice(`Invoice ${invoiceNumber} deleted.`);
    } catch (err) {
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
      const copy = await createInvoice({ ...rest, status: 'Draft' });
      refresh();
      showNotice(`Duplicated as ${copy.invoiceNumber}.`);
    } catch (err) {
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
                      <th key={h} style={{
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
                          <div style={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <button onClick={() => onOpenInvoice(invoice.id, 'view')} title="View" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Eye size={13} /></button>
                            <button onClick={() => onOpenInvoice(invoice.id, 'edit')} title="Edit" className="btn-icon" style={{ border: 'none', cursor: 'pointer' }}><Pencil size={13} /></button>
                            <button onClick={() => handleDuplicate(invoice.id)} disabled={rowBusy} title="Duplicate" className="btn-icon" style={{ border: 'none', cursor: rowBusy ? 'default' : 'pointer' }}>
                              {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                            </button>
                            <button
                              onClick={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                              disabled={rowBusy}
                              title="Delete"
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
    </div>
  );
}
