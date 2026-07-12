/**
 * Operational error carrying an HTTP status code, so services can
 * throw meaningful, specific errors (404 not found, 409 duplicate,
 * 400 invalid input) and the shared error-handling middleware
 * (middleware/errorHandler.js) can turn them into the right response
 * without controllers having to know the status code themselves.
 */
export class AppError extends Error {
  /** `stage` is optional (Sprint 6.2B) — pipeline callers (currently
      just the email send flow) can name which step failed
      ("attachment" | "archive" | "drive" | "email" | "validation") so
      the client gets more than a generic message. Omitted entirely
      from the JSON response by errorHandler.js when not set, so every
      other AppError call site is unaffected. */
  constructor(message, statusCode = 500, stage) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.stage = stage;
    Error.captureStackTrace(this, this.constructor);
  }
}
