'use strict';

/**
 * Wraps async route handlers to eliminate try/catch boilerplate.
 * Automatically passes unhandled errors to next().
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
