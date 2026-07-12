import { SalaryHistoryRecord } from '../types';

/**
 * Centralised Salary History API client — mirrors src/api/employeeApi.ts's
 * design exactly (same request() helper, same ApiError, same envelope
 * handling). Every network call the frontend makes for salary history
 * data goes through this file; nothing outside src/api/ should call
 * `fetch` for it directly.
 *
 * Unlike employeeApi.ts, no field renaming is needed here — the
 * backend schema (backend/src/models/SalaryHistory.js) uses the exact
 * same field names as the frontend's existing SalaryHistoryRecord
 * interface (src/types.ts). The only translation is `_id` <-> `id`,
 * the same convention already used for Employee.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

/** Wire shape returned by the backend — SalaryHistoryRecord's fields
    plus Mongo's _id/createdAt/updatedAt instead of a client-side id. */
interface SalaryHistoryApiRecord extends Omit<SalaryHistoryRecord, 'id'> {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedSalaryHistory {
  items: SalaryHistoryRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface SalaryHistoryQueryParams {
  page?: number;
  limit?: number;
  month?: string;
  year?: string;
  employeeId?: string;
  q?: string;
  sort?: 'newest' | 'oldest';
}

/** Thrown by every function in this file on any failure — same
    contract as employeeApi.ts's ApiError. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function fromApiRecord(record: SalaryHistoryApiRecord): SalaryHistoryRecord {
  const { _id, createdAt, updatedAt, ...rest } = record;
  void createdAt;
  void updatedAt;
  return { id: _id, ...rest };
}

function toApiPayload(record: SalaryHistoryRecord): Record<string, unknown> {
  const { id, ...rest } = record;
  void id;
  return rest;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    // Network-level failure — server down, wrong URL, CORS block, offline, etc.
    throw new ApiError('Unable to connect to server');
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* Non-JSON response — fall through, handled by the !res.ok check below. */
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

type SalaryHistoryListResponse = { items: SalaryHistoryApiRecord[]; total: number; page: number; limit: number; totalPages: number };

function toPaginatedSalaryHistory(data: SalaryHistoryListResponse): PaginatedSalaryHistory {
  return { ...data, items: data.items.map(fromApiRecord) };
}

export async function getSalaryHistory(params: SalaryHistoryQueryParams = {}): Promise<PaginatedSalaryHistory> {
  const data = await request<SalaryHistoryListResponse>(
    `/salary-history${buildQuery({
      page: params.page,
      limit: params.limit,
      month: params.month,
      year: params.year,
      employeeId: params.employeeId,
      q: params.q,
      sort: params.sort,
    })}`
  );
  return toPaginatedSalaryHistory(data);
}

export async function getSalaryHistoryRecord(id: string): Promise<SalaryHistoryRecord> {
  const record = await request<SalaryHistoryApiRecord>(`/salary-history/${id}`);
  return fromApiRecord(record);
}

export async function createSalaryHistory(record: SalaryHistoryRecord): Promise<SalaryHistoryRecord> {
  const saved = await request<SalaryHistoryApiRecord>('/salary-history', {
    method: 'POST',
    body: JSON.stringify(toApiPayload(record)),
  });
  return fromApiRecord(saved);
}

export async function updateSalaryHistory(id: string, record: SalaryHistoryRecord): Promise<SalaryHistoryRecord> {
  const saved = await request<SalaryHistoryApiRecord>(`/salary-history/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toApiPayload(record)),
  });
  return fromApiRecord(saved);
}

export async function deleteSalaryHistory(id: string): Promise<void> {
  await request<null>(`/salary-history/${id}`, { method: 'DELETE' });
}
