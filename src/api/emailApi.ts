/**
 * Centralised Email Automation API client (Sprint 5.5) — mirrors the
 * design of pdfApi.ts / salaryHistoryApi.ts (same ApiError, same
 * envelope handling). The backend always fetches the PDF attachment
 * from the already-stored PDF Archive by pdfArchiveId; nothing here
 * ever uploads or re-sends PDF bytes.
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

export async function sendSalaryEmail(params: SendSalaryEmailParams): Promise<EmailLogResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
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
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body.data;
}
