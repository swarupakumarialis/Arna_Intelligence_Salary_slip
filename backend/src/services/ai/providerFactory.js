import { RuleBasedProvider } from './providers/RuleBasedProvider.js';
import { LLMProvider } from './providers/LLMProvider.js';

/**
 * The ONE place in the backend that decides which AIProvider
 * implementation is active. ai.service.js calls getAIProvider() and
 * only ever calls the shared AIProvider methods (detectIntent /
 * formatResponse) on whatever comes back — it never imports
 * RuleBasedProvider or LLMProvider directly, and never branches on
 * which one is running. Switching providers (rule-based → llm) or
 * vendors (claude → openai → gemini → azure-openai) is an environment
 * variable change here only:
 *
 *   AI_PROVIDER=rule-based   (default — Version 1, no API key needed)
 *   AI_PROVIDER=llm
 *   AI_LLM_VENDOR=claude|openai|gemini|azure-openai
 *   AI_LLM_API_KEY=...
 *   AI_LLM_MODEL=...          (optional, vendor-specific)
 */
let cachedProvider = null;

export function getAIProvider() {
  if (cachedProvider) return cachedProvider;

  const providerKind = (process.env.AI_PROVIDER || 'rule-based').trim().toLowerCase();

  if (providerKind === 'llm') {
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

/** Clears the cached singleton so a changed AI_PROVIDER/AI_LLM_* env
    var takes effect without restarting the process — used by tests and
    available for hot-reload tooling; normal request handling never
    calls this. */
export function resetAIProviderCache() {
  cachedProvider = null;
}
