'use strict';

const AppError = require('../shared/utils/AppError');
const asyncHandler = require('../shared/utils/asyncHandler');

/**
 * Middleware to check if user account is locked
 */
const accountLock = asyncHandler(async (req, res, next) => {
  const user = req.user;

  if (!user) return next();

  if (user.isLocked) {
    return next(new AppError('Account locked. Please contact administrator.', 403));
  }

  next();
});

module.exports = accountLock;
