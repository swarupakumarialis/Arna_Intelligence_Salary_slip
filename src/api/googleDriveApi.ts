/**
 * Centralised Google Drive connection API client (Sprint 6.2A) —
 * mirrors the design of pdfApi.ts / employeeApi.ts (same ApiError,
 * same envelope handling). Never receives or handles a refresh
 * token, access token, or client secret — the backend only ever
 * returns connection status fields here.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

export interface GoogleDriveStatus {
  connected: boolean;
  email?: string | null;
  rootFolderName?: string | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
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

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  return request<GoogleDriveStatus>('/integrations/google-drive/status');
}

/** Fetches the Google consent URL, then navigates the whole browser
    tab there — this must be a full navigation, not a fetch-and-render,
    since Google's consent screen is not embeddable and the flow ends
    with Google redirecting the browser back to our own callback route. */
export async function connectGoogleDrive(): Promise<void> {
  const { url } = await request<{ url: string }>('/integrations/google-drive/auth-url');
  window.location.href = url;
}

export async function disconnectGoogleDrive(): Promise<void> {
  await request<null>('/integrations/google-drive/disconnect', { method: 'POST' });
}

export async function testGoogleDriveConnection(): Promise<{ ok: boolean; user: string | null }> {
  return request<{ ok: boolean; user: string | null }>('/integrations/google-drive/test', { method: 'POST' });
}
