/**
 * ARNA AI Assistant (Sprint 8, Version 1 — read-only; Sprint 9 —
 * global floating widget + conversation context) API client — the one
 * place the frontend talks to POST /api/ai/ask. Same request()/
 * ApiError shape every other src/api/*.ts file already uses.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api';

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

/** Company/Invoice Settings live entirely in browser localStorage (see
    utils/companySettingsStore.ts / modules/finance/utils/invoiceSettingsStore.ts)
    — there is no backend model for them (confirmed: nothing in
    backend/src is a "Company"/"CompanySettings" collection). Company-
    related questions ("What is the company name?", "What is the
    default currency?", "Invoice prefix", "Default tax") can only be
    answered by sending the current values along with the question;
    AiAssistantPage.tsx builds this from the same two stores every
    other Company/Invoice Settings screen already reads. */
export interface AiAssistantContext {
  companyName?: string;
  defaultCurrency?: string;
  baseCurrency?: string;
  invoicePrefix?: string;
  defaultTaxPercent?: number;
}

/** The last assistant turn, as the backend returned it — echoed back
    verbatim on the NEXT question so ai.service.js can resolve a
    follow-up ("name them", "show all") against it. This is the entire
    conversation-context mechanism (Sprint 9, requirement 6/7): the
    backend keeps no session of its own, so a follow-up only works
    because the client hands back exactly what it was told last time.
    Never persisted anywhere but the browser (see AiAssistantWidget.tsx's
    sessionStorage-backed history) — nothing conversation-related is
    ever written to MongoDB. */
export interface AiAssistantTurn {
  intent: string;
  entities: Record<string, unknown>;
}

export interface AiAssistantResponse extends AiAssistantTurn {
  data: unknown;
  message: string;
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

export async function askAiAssistant(
  question: string,
  context: AiAssistantContext,
  previous?: AiAssistantTurn
): Promise<AiAssistantResponse> {
  return request<AiAssistantResponse>('/ai/ask', {
    method: 'POST',
    body: JSON.stringify({ question, context, previous }),
  });
}
