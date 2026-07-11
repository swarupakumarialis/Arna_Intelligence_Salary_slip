/**
 * Operational error carrying an HTTP status code, so services can
 * throw meaningful, specific errors (404 not found, 409 duplicate,
 * 400 invalid input) and the shared error-handling middleware
 * (middleware/errorHandler.js) can turn them into the right response
 * without controllers having to know the status code themselves.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
