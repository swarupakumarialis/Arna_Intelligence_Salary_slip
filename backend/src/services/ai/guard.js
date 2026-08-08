/**
 * The single, provider-agnostic read-only guard (Sprint 9 — Gemini
 * integration). Checked by ai.service.js BEFORE any AIProvider —
 * RuleBasedProvider, GeminiProvider, or any future provider — is even
 * invoked. This is what makes "must never modify data" and "read-only
 * is enforced by backend code, not by the [LLM] prompt alone" true
 * structurally: even a provider that somehow misclassifies "Delete
 * Rahul" or "Send the invoice" as an ordinary lookup never gets the
 * chance to, because this check runs first and short-circuits straight
 * to the fixed refusal message.
 *
 * RuleBasedProvider.js also imports these same patterns for its own
 * classify() — not because the check needs to happen twice (it
 * doesn't; ai.service.js's pre-check already covers every provider),
 * but so RuleBasedProvider's own intent vocabulary still includes
 * BLOCKED_ACTION for direct/standalone use and tests, without a second,
 * possibly-drifting copy of the pattern list living in that file too.
 *
 * Base verb forms with \b word boundaries so past-tense read queries
 * ("invoices GENERATED this month", "salary emails SENT") never
 * false-positive: \bgenerate\b does not match inside "generated" (no
 * word boundary between "e" and "d"), same for \bsend\b vs "sent",
 * \bcreate\b vs "created", \bupload\b vs "uploaded", \bdelete\b vs
 * "deleted".
 */
export const BLOCKED_PATTERNS = [
  /\bdelete\b/i,
  /\bremove\b.*\b(employee|invoice|record)\b/i,
  /\b(generate|create)\b.*\b(salary|payslip|slip|invoice)\b/i,
  /\bsend\b.*\b(email|invoice|payslip|salary|slip)\b/i,
  /\bupload\b/i,
  /\b(edit|update|modify|change)\b.*\b(employee|invoice|record|status)\b/i,
];

/** @param {string} question @returns {boolean} */
export function isBlockedAction(question) {
  const q = String(question || '');
  return BLOCKED_PATTERNS.some((re) => re.test(q));
}
