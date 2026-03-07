'use strict';

const AppError = require('../shared/utils/AppError');
const asyncHandler = require('../shared/utils/asyncHandler');

/**
 * Middleware to check if user account is locked or trial has expired
 */
const trialLock = asyncHandler(async (req, res, next) => {
  const user = req.user;

  if (!user) return next();

  if (user.isLocked) {
    return next(new AppError('Account locked. Please contact administrator.', 403));
  }

  if (user.isTrialUser && user.trialExpiresAt && new Date() > user.trialExpiresAt) {
    user.isLocked = true;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Trial expired. Please contact administrator to continue.', 403));
  }

  next();
});

module.exports = trialLock;
