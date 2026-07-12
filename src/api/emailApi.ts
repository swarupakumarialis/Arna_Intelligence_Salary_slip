/**
 * Centralised Email Automation API client (Sprint 5.5, refactored
 * Sprint 6.2B) — mirrors the design of pdfApi.ts / salaryHistoryApi.ts
 * (same ApiError, same envelope handling). Sprint 6.2B: the backend no
 * longer reads the PDF to attach off local disk (that was the cause
 * of emails failing in production while working on localhost) — the
 * caller now sends the exact same in-memory PDF Blob it already used
 * for the Google Drive upload, as a multipart attachment, same as
 * pdfApi.ts's uploadPdf().
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

export interface SendSalaryEmailParams {
  employeeId: string;
  employeeName: string;
  recipientEmail: string;
  month: string;
  year: string;
  salaryHistoryId: string;
  pdfArchiveId: string;
  /** Optional override — falls back to the backend's canonical
      "Salary Slip – {Month} {Year} | ARNA Intelligence" subject when omitted. */
  subject?: string;
  /** The exact same in-memory PDF the caller already generated (and,
      in the normal flow, already uploaded to Google Drive) — attached
      to the outgoing email as-is, never re-read from disk or Drive. */
  pdfBlob: Blob;
}

export interface EmailLogResult {
  _id: string;
  status: 'Sent' | 'Failed';
  recipientEmail: string;
  sentAt: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  stage?: string | null;
  data: T;
}

export class ApiError extends Error {
  status?: number;
  /** Which pipeline step failed (Sprint 6.2B) — "attachment" |
      "archive" | "drive" | "email" | "validation" — when the backend
      set one; undefined for errors that predate stage-tagging. */
  stage?: string | null;
  constructor(message: string, status?: number, stage?: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.stage = stage;
  }
}

export async function sendSalaryEmail(params: SendSalaryEmailParams): Promise<EmailLogResult> {
  const formData = new FormData();
  formData.append('pdf', params.pdfBlob, 'attachment.pdf');
  formData.append('employeeId', params.employeeId);
  formData.append('employeeName', params.employeeName);
  formData.append('recipientEmail', params.recipientEmail);
  formData.append('month', params.month);
  formData.append('year', params.year);
  formData.append('salaryHistoryId', params.salaryHistoryId);
  formData.append('pdfArchiveId', params.pdfArchiveId);
  if (params.subject) formData.append('subject', params.subject);

  let res: Response;
  try {
    // Deliberately not using the shared JSON request() helper — a
    // file attachment is FormData, and must NOT have a Content-Type
    // header set manually (see pdfApi.ts's uploadPdf for the same
    // reasoning): the browser computes the correct multipart boundary
    // itself when given a FormData body.
    res = await fetch(`${API_BASE_URL}/email/send`, { method: 'POST', body: formData });
  } catch {
    throw new ApiError('Unable to connect to server');
  }

  let body: ApiEnvelope<EmailLogResult> | null = null;
  try {
    body = await res.json();
  } catch {
    /* Non-JSON response — fall through, handled by the !res.ok check below. */
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status, body?.stage);
  }
  return body.data;
}
