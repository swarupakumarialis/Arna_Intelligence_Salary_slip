/**
 * Generic 404 + error-handling middleware. This is infrastructure, not
 * business logic — every future route (employees, salary, auth, …)
 * benefits from the same consistent JSON error shape without each one
 * having to implement it. Mounted last in src/app.js, after all routes.
 */

export function notFound(req, res, next) {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
}
