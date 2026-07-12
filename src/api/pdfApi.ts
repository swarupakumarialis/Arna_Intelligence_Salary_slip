/**
 * Centralised PDF Archive API client — mirrors the design of
 * employeeApi.ts / salaryHistoryApi.ts (same ApiError, same envelope
 * handling), except uploadPdf() which sends multipart/form-data
 * instead of JSON, since it carries a binary file.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

export interface PdfArchiveMetadata {
  _id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: string;
  salaryHistoryId: string | null;
  pdfFileName: string;
  pdfPath: string;
  fileSize: number;
  generatedBy: string;
  provider: 'local' | 'google-drive';
  driveFileId: string | null;
  shareUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseEnvelope<T>(res: Response): Promise<T> {
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Unable to connect to server');
  }
  return parseEnvelope<T>(res);
}

export interface UploadPdfParams {
  file: Blob;
  fileName: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: string;
  salaryHistoryId?: string;
  generatedBy?: string;
}

/** Uploads a generated payslip PDF for permanent storage. Deliberately
    a standalone fetch (not the shared request() helper above) — a
    file upload is FormData, not JSON, and must NOT have a
    Content-Type header set manually: the browser computes the correct
    multipart/form-data boundary itself when given a FormData body. */
export async function uploadPdf(params: UploadPdfParams): Promise<PdfArchiveMetadata> {
  const formData = new FormData();
  formData.append('pdf', params.file, params.fileName);
  formData.append('employeeId', params.employeeId);
  formData.append('employeeName', params.employeeName);
  formData.append('month', params.month);
  formData.append('year', params.year);
  if (params.salaryHistoryId) formData.append('salaryHistoryId', params.salaryHistoryId);
  if (params.generatedBy) formData.append('generatedBy', params.generatedBy);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/pdf/upload`, { method: 'POST', body: formData });
  } catch {
    throw new ApiError('Unable to connect to server');
  }
  return parseEnvelope<PdfArchiveMetadata>(res);
}

export async function getPdfMetadata(id: string): Promise<PdfArchiveMetadata> {
  return request<PdfArchiveMetadata>(`/pdf/${id}`);
}

/** Not a fetch — the backend streams the file directly, so this is
    meant to be used as a plain link/window.open target (matches how a
    browser download normally works), not JSON-parsed. */
export function getPdfDownloadUrl(id: string): string {
  return `${API_BASE_URL}/pdf/download/${id}`;
}

export async function deletePdfArchive(id: string): Promise<void> {
  await request<null>(`/pdf/${id}`, { method: 'DELETE' });
}
