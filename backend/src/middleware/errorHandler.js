/**
 * Generic 404 + error-handling middleware, shared by every route.
 * Every response — success or failure — uses the same envelope
 * ({ success, message, data }), so the frontend's API layer
 * (frontend/src/api/employeeApi.ts) only has to understand one shape.
 * Mounted last in src/app.js, after all feature routers.
 */

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  // AppError (services/controllers) already carries the right HTTP status.
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation errors → 400, with a readable combined message.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // Mongoose duplicate-key errors that reach here uncaught → 409.
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}.`;
  }

  // Malformed ObjectId passed straight to Mongoose (bypassing service-level checks) → 400.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}.`;
  }

  /* stage/reason (Sprint 6.2B): only present on errors that set
     AppError's optional `stage` (currently the email pipeline), so a
     client can branch on *which step* failed rather than just
     pattern-matching the message string. `reason` mirrors `message`
     under the name used in this app's own stage-aware error examples;
     every other caller keeps reading `message` exactly as before. */
  res.status(statusCode).json({
    success: false,
    message,
    stage: err.stage || null,
    reason: message,
    data: null,
  });
}
