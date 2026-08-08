import { GoogleGenAI } from '@google/genai';
import { AIProvider } from './AIProvider.js';
import { INTENT } from '../intents.js';

/**
 * Sprint 9 — Gemini as an optional, swappable AIProvider. Implements
 * the exact same two-method contract RuleBasedProvider.js already
 * does (see AIProvider.js) — ai.service.js and the frontend never know
 * or care that this is Gemini instead of the default rule-based
 * classifier; providerFactory.js is the ONLY place that decides which
 * one is active (AI_PROVIDER=gemini + GEMINI_API_KEY).
 *
 * Security model (defense in depth, not "trust the prompt"):
 *  1. ai.service.js's isBlockedAction() pre-check (../guard.js) runs
 *     BEFORE any provider — this one included — is even called. A
 *     question that reads as create/update/delete/send/upload/modify
 *     never reaches Gemini at all.
 *  2. detectIntent() below validates whatever Gemini returns against
 *     ALLOWED_INTENTS — the exact same fixed vocabulary in ../intents.js
 *     that RuleBasedProvider is limited to. Anything not on that list
 *     (a hallucinated intent, a stray "delete_employee", free text,
 *     malformed JSON) is rejected and downgraded to INTENT.UNKNOWN —
 *     never passed through to ai.service.js's resolveData() switch.
 *  3. Gemini is NEVER given a MongoDB connection, credentials, or raw
 *     documents. detectIntent() only ever receives the user's question
 *     text plus the previous turn's already-sanitized {intent, entities}
 *     (see ai.service.js's `previous` param). formatResponse() only
 *     ever receives the exact `data` object ai.service.js already
 *     fetched and field-allowlisted for the SAME intents RuleBasedProvider
 *     would have received (PAN/Aadhaar/bank details/UAN/raw salary are
 *     already stripped upstream — see ai.service.js's pickPublicEmployeeFields
 *     — before this file ever sees anything).
 *  4. Every request goes through generateJson()'s timeout + JSON-parse
 *     + shape validation. Any failure (missing key, network error,
 *     timeout, invalid JSON, empty response) throws — ai.service.js
 *     catches that and falls back to RuleBasedProvider automatically
 *     (Sprint 9 Part 6), so the assistant keeps working either way.
 */

// Google's own "-latest" alias, not a pinned version number — it
// always resolves to their current recommended fast/cheap model
// without this file needing an update every time a version is
// deprecated (which is exactly what happened during this sprint's own
// testing: a pinned 'gemini-2.5-flash' had already been cut off from
// new API keys). GEMINI_MODEL can still override this with a specific
// pinned version if that's ever preferred.
const DEFAULT_MODEL = 'gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 10000;

/** Every intent Gemini is allowed to return, in one place — reused
    verbatim from ../intents.js so this list can never drift out of
    sync with what RuleBasedProvider (and ai.service.js's resolveData
    switch) actually understands. BLOCKED_ACTION is deliberately
    excluded: Gemini is never asked to self-report a blocked action
    (that's guard.js's job, upstream of this provider entirely) — if
    Gemini ever does return it anyway, detectIntent() below treats it
    as UNKNOWN rather than trusting it. */
const ALLOWED_INTENTS = new Set(Object.values(INTENT).filter((i) => i !== INTENT.BLOCKED_ACTION));

export class GeminiConfigError extends Error {}
export class GeminiRequestError extends Error {}

/** One line per intent group, mirroring ../intents.js's own doc
    comments — kept here (not imported) because this is prompt text
    for a model, not code; the underlying intent *names* are still the
    single source of truth in intents.js via ALLOWED_INTENTS above. */
const INTENT_GUIDE = `
Employees:
- employee_lookup {name}: "Tell me about Priya", "Search for Rahul", "Give me employee details", a bare name
- employee_count {status, employmentType, department}: "How many employees?", "Who is active?", "Show interns.", "Show contract employees.", "Show Finance employees."
- employee_joined_this_month {}: "Who joined this month?"
- employee_recent {}: "Who joined recently?"

Invoices:
- invoice_count {status}: status is one of Paid, Draft, Sent, Overdue, Cancelled, "Partially Paid", or the group "unpaid" — "How many invoices?", "How many are paid?", "Show overdue invoices.", "Show draft invoices."
- invoice_outstanding {}: "How many are unpaid?", "What is outstanding?", "Invoice summary."
- invoice_largest {status}
- invoice_recent {}: "Show recent invoices."
- invoice_this_month {}

Payroll:
- payroll_this_month {}: "How many salary records this month?", "Payroll summary."
- payroll_emails_sent {}: "How many salary emails were sent?"
- payroll_emails_pending {}: "How many salary emails failed?" / are pending
- payroll_employee_count {}
- payroll_department_count {}: "How many departments?"
- payroll_total_amount {}

Company / System:
- company_name {}: "Company name."
- company_currency {}: "Current currency."
- company_drive_status {}: "Is Google Drive connected?"
- company_email_status {}: "Is email configured?"
- system_health {}: "System health."

Meta:
- greeting {}, help {}, follow_up_list {}: "name them", "show all", "yes" (refers to the previous answer)
- unknown {}: anything that doesn't match, is unclear, or looks like a write/action request
`.trim();

function buildIntentPrompt(question, previous) {
  const previousLine = previous && previous.intent
    ? `The previous answer was for intent "${previous.intent}" with entities ${JSON.stringify(previous.entities || {})}.`
    : 'There is no previous turn.';
  return `You are the intent classifier for ARNA IntelliPayRoll, a READ-ONLY HR/payroll assistant. You never take actions — you only classify.

Allowed intents and when to use them:
${INTENT_GUIDE}

${previousLine}

Rules:
- Reply with ONLY compact JSON: {"intent": "<one intent from the list above, lowercase, exact spelling>", "entities": {...}}.
- entities must only contain the keys shown for that intent (or be {}). Never invent extra keys.
- If the question asks to create, update, delete, send, upload, generate, or modify anything, reply {"intent":"unknown","entities":{}} — you are never the one who decides that's allowed; assume it is not.
- If nothing matches, or the question is unclear, reply {"intent":"unknown","entities":{}}.
- Never output an intent that is not in the list above.

Question: """${question}"""`;
}

function buildFormatPrompt(intent, data, question) {
  return `You are ARNA IntelliPayRoll AI Assistant — concise, professional, HR-friendly, and strictly read-only.

The user asked: "${question}"

This is the ONLY information you may use to answer — it has already been fetched and safety-filtered by the backend (no salary/PAN/Aadhaar/bank/UAN details beyond what's shown, if anything):
${JSON.stringify(data)}

Reply with ONLY compact JSON: {"message": "<your answer>"}.

Formatting rules for the message text:
- Plain, natural sentences. Use "- " at the start of a line for a bullet list, and "**text**" for emphasis — no other markdown (no headers, no tables, no code blocks).
- Be concise (well under 100 words unless a list of items is genuinely needed).
- Never mention JSON, field names, "the data", or that you are an AI model.
- If the data shows zero/none/not found, say so plainly and helpfully — don't apologize excessively.
- Never state or imply you performed any action — you only report what already exists.`;
}

export class GeminiProvider extends AIProvider {
  constructor({ apiKey, model } = {}) {
    super();
    this.apiKey = apiKey || '';
    this.model = model || DEFAULT_MODEL;
    this._client = null;
  }

  assertConfigured() {
    if (!this.apiKey) {
      throw new GeminiConfigError(
        'AI_PROVIDER is set to "gemini" but GEMINI_API_KEY is not set. ' +
        'Set GEMINI_API_KEY in the environment, or switch AI_PROVIDER back to "rule-based".'
      );
    }
  }

  /** Lazily constructed — a missing/invalid API key never crashes the
      app at import/boot time (Part 1's "do not crash"), only the first
      time this provider is actually asked to do something. */
  client() {
    if (!this._client) {
      this._client = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this._client;
  }

  withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new GeminiRequestError('Gemini request timed out.')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  /** Single call path for both AIProvider methods — always asks Gemini
      for a strict JSON object (responseMimeType), always parses it,
      always throws a GeminiRequestError on anything unexpected rather
      than returning something ai.service.js might misinterpret as a
      valid result. */
  async generateJson(prompt) {
    this.assertConfigured();
    const ai = this.client();
    let response;
    try {
      response = await this.withTimeout(
        ai.models.generateContent({
          model: this.model,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature: 0 },
        }),
        REQUEST_TIMEOUT_MS
      );
    } catch (err) {
      if (err instanceof GeminiRequestError) throw err;
      throw new GeminiRequestError(`Gemini request failed: ${err.message}`);
    }

    const text = String(response?.text || '').trim();
    if (!text) throw new GeminiRequestError('Gemini returned an empty response.');

    try {
      return JSON.parse(text);
    } catch {
      throw new GeminiRequestError('Gemini returned invalid structured output (not valid JSON).');
    }
  }

  async detectIntent(question, context) {
    const previous = context?.previous;
    const raw = await this.generateJson(buildIntentPrompt(String(question || ''), previous));

    const intent = typeof raw?.intent === 'string' ? raw.intent.trim().toLowerCase() : '';
    const entities = raw && typeof raw.entities === 'object' && raw.entities !== null && !Array.isArray(raw.entities)
      ? raw.entities
      : {};

    // Explicit allowlist check (Part 7) — an intent Gemini invents, or
    // BLOCKED_ACTION (which Gemini is never trusted to self-report),
    // is downgraded to UNKNOWN rather than reaching ai.service.js's
    // resolveData() switch.
    if (!ALLOWED_INTENTS.has(intent)) {
      return { intent: INTENT.UNKNOWN, entities: {} };
    }
    return { intent, entities };
  }

  async formatResponse(intent, data, question) {
    const raw = await this.generateJson(buildFormatPrompt(intent, data, String(question || '')));
    const message = typeof raw?.message === 'string' ? raw.message.trim() : '';
    if (!message) throw new GeminiRequestError('Gemini returned an empty formatted response.');
    return message;
  }
}
