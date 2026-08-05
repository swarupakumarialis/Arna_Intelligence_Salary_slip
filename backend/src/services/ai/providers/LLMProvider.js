import { AIProvider } from './AIProvider.js';

/**
 * Version 2 placeholder. This is where a real vendor call gets wired in
 * later — Claude, OpenAI, Gemini, or Azure OpenAI — behind the exact
 * same AIProvider contract RuleBasedProvider already implements, so
 * ai.service.js's read-only guard, intent-to-service dispatch, and the
 * frontend chat UI never need to change when this goes live. Which
 * vendor is active is a config value (`vendor`, from AI_LLM_VENDOR),
 * not a different class — adding a fifth vendor later means adding one
 * branch to callVendor() below, not a new provider.
 *
 * No vendor SDK is installed and no API key is required to run this
 * app today (Version 1 ships fully offline on RuleBasedProvider). This
 * class only throws a clear "not yet implemented" error if it's ever
 * actually selected (AI_PROVIDER=llm) without a real implementation —
 * it exists so the provider-abstraction shape is real and testable now,
 * not bolted on later.
 */
export class LLMProvider extends AIProvider {
  constructor({ vendor, apiKey, model } = {}) {
    super();
    this.vendor = vendor;
    this.apiKey = apiKey;
    this.model = model;
  }

  async detectIntent(question, context) { // eslint-disable-line no-unused-vars
    this.assertConfigured();
    // Version 2: send `question` to callVendor() below along with the
    // fixed intent vocabulary (../intents.js's INTENT) and ask the
    // model to return { intent, entities } as structured output (e.g.
    // Claude/OpenAI tool-use or a strict JSON response format) — same
    // shape RuleBasedProvider.detectIntent already returns, so nothing
    // downstream changes.
    throw new Error(`LLMProvider ("${this.vendor}") is not implemented yet — this is a Version 2 placeholder. Set AI_PROVIDER=rule-based to use the default provider.`);
  }

  async formatResponse(intent, data, question) { // eslint-disable-line no-unused-vars
    this.assertConfigured();
    // Version 2: send the already-fetched, already-scoped `data`
    // ai.service.js prepared for this intent to callVendor() and ask
    // it to phrase the final reply — never the raw database, and never
    // more fields than RuleBasedProvider.formatResponse would have
    // received for the same intent (see AIProvider.js's contract).
    throw new Error(`LLMProvider ("${this.vendor}") is not implemented yet — this is a Version 2 placeholder. Set AI_PROVIDER=rule-based to use the default provider.`);
  }

  assertConfigured() {
    if (!this.apiKey) {
      throw new Error(
        `AI_PROVIDER is set to "llm" but no API key is configured for vendor "${this.vendor}". ` +
        `Set AI_LLM_API_KEY (and AI_LLM_VENDOR=claude|openai|gemini|azure-openai) in the environment, ` +
        `or switch AI_PROVIDER back to "rule-based".`
      );
    }
  }

  /** Single dispatch point for whichever vendor is configured — the
      one place a real SDK call gets added per vendor, once Version 2
      actually implements this. Kept as a stub now so the extension
      point is explicit rather than implied. */
  async callVendor(messages) { // eslint-disable-line no-unused-vars
    switch (this.vendor) {
      case 'claude':
        // Version 2: @anthropic-ai/sdk, this.apiKey, this.model (e.g. 'claude-sonnet-5')
        throw new Error('Claude vendor call not implemented yet.');
      case 'openai':
        // Version 2: openai SDK, this.apiKey, this.model (e.g. 'gpt-4o')
        throw new Error('OpenAI vendor call not implemented yet.');
      case 'gemini':
        // Version 2: @google/generative-ai SDK, this.apiKey, this.model
        throw new Error('Gemini vendor call not implemented yet.');
      case 'azure-openai':
        // Version 2: openai SDK configured for an Azure endpoint, this.apiKey, this.model (deployment name)
        throw new Error('Azure OpenAI vendor call not implemented yet.');
      default:
        throw new Error(`Unknown AI_LLM_VENDOR "${this.vendor}" — expected claude, openai, gemini, or azure-openai.`);
    }
  }
}
