import * as aiService from '../services/ai.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

/**
 * Thin HTTP layer only, same convention as every other controller in
 * this backend — request-shape parsing here, everything else
 * (intent detection, service dispatch, response formatting) lives in
 * services/ai.service.js.
 */

export const ask = asyncHandler(async (req, res) => {
  const { question, context, previous } = req.body || {};
  if (typeof question !== 'string' || !question.trim()) {
    throw new AppError('question is required', 400, 'validation');
  }
  const data = await aiService.ask(
    question,
    context && typeof context === 'object' ? context : {},
    previous && typeof previous === 'object' ? previous : undefined
  );
  res.status(200).json({ success: true, message: 'AI Assistant response', data });
});
