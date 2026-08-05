/**
 * The contract every AI provider implementation must satisfy.
 * ai.service.js (the orchestrator) only ever calls these two methods on
 * whatever provider providerFactory.js hands it — it never knows or
 * cares whether that's RuleBasedProvider (Version 1's default, no
 * external dependency, runs fully offline) or a future LLMProvider
 * (Claude / OpenAI / Gemini / Azure OpenAI, Version 2). Swapping which
 * concrete class is active is a config change in providerFactory.js
 * only; nothing else in the backend — or the frontend, which only ever
 * talks to POST /api/ai/ask — needs to change.
 *
 * Both methods are intentionally free of any MongoDB/service-layer
 * knowledge: detectIntent only classifies text, formatResponse only
 * turns already-fetched, already-scoped data into a chat message.
 * Fetching the data in between is ai.service.js's job, not the
 * provider's — that's what keeps "reuse existing services, don't
 * duplicate business logic" true regardless of which provider runs.
 */
export class AIProvider {
  /**
   * Classify a raw user question into one of the intents in
   * ../intents.js, plus whatever entities were extracted from it (e.g.
   * an employee name, a department, an invoice status).
   *
   * @param {string} question - the user's raw natural-language question
   * @param {object} [context] - optional extra context the frontend sent
   *   alongside the question (currently: the current Company/Invoice
   *   Settings snapshot, since that data lives in browser localStorage,
   *   not MongoDB — see ai.service.js)
   * @returns {Promise<{ intent: string, entities: Record<string, unknown> }>}
   */
  async detectIntent(question, context) { // eslint-disable-line no-unused-vars
    throw new Error('AIProvider.detectIntent() must be implemented by a subclass');
  }

  /**
   * Turn an intent + the exact structured data ai.service.js already
   * fetched for it into the final chat message shown to the user.
   *
   * @param {string} intent - one of the constants in ../intents.js
   * @param {object|null} data - the already-scoped JSON ai.service.js
   *   fetched from existing backend services for this intent — never
   *   the raw database, never more than the question needs (e.g. an
   *   employee lookup's `data` never contains PAN/Aadhaar/bank details/
   *   salary — those fields are stripped before formatResponse ever
   *   sees them, so no provider, rule-based or LLM, can leak them)
   * @param {string} question - the original question, for tone/context
   * @returns {Promise<string>} - the final chat message
   */
  async formatResponse(intent, data, question) { // eslint-disable-line no-unused-vars
    throw new Error('AIProvider.formatResponse() must be implemented by a subclass');
  }
}
