/**
 * Wraps an async Express route handler so a rejected promise (thrown
 * error) is forwarded to next(err) automatically, instead of every
 * controller needing its own try/catch boilerplate around await calls.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
