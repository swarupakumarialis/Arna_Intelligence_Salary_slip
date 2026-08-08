import { RuleBasedProvider } from './providers/RuleBasedProvider.js';
import { LLMProvider } from './providers/LLMProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';

/**
 * The ONE place in the backend that decides which AIProvider
 * implementation is active. ai.service.js calls getAIProvider() and
 * only ever calls the shared AIProvider methods (detectIntent /
 * formatResponse) on whatever comes back — it never imports
 * RuleBasedProvider, GeminiProvider, or LLMProvider directly, and never
 * branches on which one is running. Switching providers (rule-based →
 * gemini → llm) or vendors (claude → openai → azure-openai, under
 * AI_PROVIDER=llm) is an environment variable change here only:
 *
 *   AI_PROVIDER=rule-based   (default — Version 1, no API key needed)
 *   AI_PROVIDER=gemini       (Sprint 9 — Google Gemini, needs GEMINI_API_KEY)
 *   GEMINI_API_KEY=...
 *   GEMINI_MODEL=...          (optional, defaults to gemini-2.5-flash)
 *   AI_PROVIDER=llm           (Version 2 placeholder — Claude/OpenAI/Azure OpenAI)
 *   AI_LLM_VENDOR=claude|openai|azure-openai
 *   AI_LLM_API_KEY=...
 *   AI_LLM_MODEL=...          (optional, vendor-specific)
 */
let cachedProvider = null;
let cachedFallbackProvider = null;

export function getAIProvider() {
  if (cachedProvider) return cachedProvider;

  const providerKind = (process.env.AI_PROVIDER || 'rule-based').trim().toLowerCase();

  if (providerKind === 'gemini') {
    cachedProvider = new GeminiProvider({
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || '',
    });
  } else if (providerKind === 'llm') {
    cachedProvider = new LLMProvider({
      vendor: (process.env.AI_LLM_VENDOR || 'claude').trim().toLowerCase(),
      apiKey: process.env.AI_LLM_API_KEY || '',
      model: process.env.AI_LLM_MODEL || '',
    });
  } else {
    cachedProvider = new RuleBasedProvider();
  }

  return cachedProvider;
}

/** Always a RuleBasedProvider, regardless of AI_PROVIDER — the
    guaranteed-available fallback (Sprint 9 Part 6) ai.service.js
    switches to when the configured provider (e.g. Gemini) is
    unreachable, misconfigured, times out, or returns invalid
    structured output, so the assistant keeps working either way.
    Cached separately from getAIProvider() so it never needs rebuilding
    just because AI_PROVIDER changed. */
export function getFallbackProvider() {
  if (!cachedFallbackProvider) cachedFallbackProvider = new RuleBasedProvider();
  return cachedFallbackProvider;
}

/** Clears both cached singletons so a changed AI_PROVIDER / GEMINI_* /
    AI_LLM_* env var takes effect without restarting the process — used
    by tests and available for hot-reload tooling; normal request
    handling never calls this. */
export function resetAIProviderCache() {
  cachedProvider = null;
  cachedFallbackProvider = null;
}
