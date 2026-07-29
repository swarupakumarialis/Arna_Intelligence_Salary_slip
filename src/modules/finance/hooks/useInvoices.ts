import { useCallback, useEffect, useState } from 'react';
import { Invoice, InvoiceStatus } from '../types';
import { ApiError, InvoiceQueryParams, deleteInvoice, getInvoices } from '../services/invoiceApi';

/**
 * Invoice History's data hook (Sprint 4). Unlike SalaryHistoryPage
 * (which is handed an already-fully-fetched array from App.tsx),
 * invoice.service.js's getAllInvoices already does real server-side
 * search/filter/sort/pagination (mirroring salaryHistory.service.js's
 * own implementation) — so this hook drives that directly with
 * request params rather than re-fetching everything and filtering
 * client-side. Kept local to the Finance module, not App.tsx, so the
 * Invoice module's data flow stays fully self-contained.
 */

const PAGE_SIZE = 10;

export type InvoiceSort = NonNullable<InvoiceQueryParams['sort']>;

interface UseInvoicesResult {
  items: Invoice[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
  q: string;
  setQ: (q: string) => void;
  status: InvoiceStatus | '';
  setStatus: (status: InvoiceStatus | '') => void;
  dateFrom: string;
  dateTo: string;
  setDateRange: (dateFrom: string, dateTo: string) => void;
  sort: InvoiceSort;
  setSort: (sort: InvoiceSort) => void;
  refresh: () => void;
  removeInvoice: (id: string) => Promise<void>;
}

export function useInvoices(): UseInvoicesResult {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageInternal] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQInternal] = useState('');
  const [status, setStatusInternal] = useState<InvoiceStatus | ''>('');
  const [dateFrom, setDateFromInternal] = useState('');
  const [dateTo, setDateToInternal] = useState('');
  const [sort, setSort] = useState<InvoiceSort>('newest');
  const [reloadToken, setReloadToken] = useState(0);

  const setPage = useCallback((next: number) => setPageInternal(next), []);
  // Changing a filter with the user parked on page 3 of the old
  // result set would otherwise strand them past the new totalPages —
  // same reset-to-first-page rule EmployeesPage.tsx already follows.
  const setQ = useCallback((next: string) => { setQInternal(next); setPageInternal(1); }, []);
  const setStatus = useCallback((next: InvoiceStatus | '') => { setStatusInternal(next); setPageInternal(1); }, []);
  const setDateRange = useCallback((from: string, to: string) => {
    setDateFromInternal(from); setDateToInternal(to); setPageInternal(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getInvoices({
      page, limit: PAGE_SIZE, q: q || undefined, status: status || undefined,
      dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, sort,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load invoices.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, q, status, dateFrom, dateTo, sort, reloadToken]);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  const removeInvoice = useCallback(async (id: string) => {
    await deleteInvoice(id);
    refresh();
  }, [refresh]);

  return {
    items, loading, error, page, totalPages, total, setPage, q, setQ, status, setStatus,
    dateFrom, dateTo, setDateRange, sort, setSort, refresh, removeInvoice,
  };
}
