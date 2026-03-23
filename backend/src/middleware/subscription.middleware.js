'use strict';

const Subscription = require('../modules/subscriptions/subscription.model');
const { PLAN_FEATURES } = require('../constants/plans');
const AppError = require('../shared/utils/AppError');
const asyncHandler = require('../shared/utils/asyncHandler');
const { ROLES } = require('../constants');

/**
 * Middleware to check if organization subscription is active and not expired
 */
const checkSubscription = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // 1. Super Admin bypass
  if (user.role === ROLES.SUPER_ADMIN) {
    return next();
  }

  if (!user.organizationId) {
    return next(new AppError('User not associated with any organization', 403));
  }

  // 2. Fetch subscription
  const subscription = await Subscription.findOne({ organizationId: user.organizationId });

  if (!subscription) {
    return next(new AppError('No active subscription found for your organization', 403));
  }

  // 3. Trial Expiry Check
  if (subscription.planType === 'TRIAL') {
    if (new Date() > subscription.trialEndDate) {
      subscription.status = 'EXPIRED';
      await subscription.save();
      return next(new AppError('Your free trial has expired. Please upgrade to continue.', 403));
    }
  }

  // 4. Status Check
  if (subscription.status !== 'ACTIVE') {
    return next(new AppError(`Subscription is ${subscription.status.toLowerCase()}. Please contact support.`, 403));
  }

  // Attach subscription to request for later use (e.g. for feature checks)
  req.subscription = subscription;
  next();
});

/**
 * Middleware to restrict access to features based on subscription plan
 * @param {string} featureName - The name of the feature to check
 */
const requireFeature = (featureName) => {
  return (req, res, next) => {
    const user = req.user;
    
    // Super Admin bypass
    if (user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    const subscription = req.subscription;
    if (!subscription) {
      return next(new AppError('Authentication required to verify features', 401));
    }

    const features = PLAN_FEATURES[subscription.planType];
    if (!features || !features[featureName]) {
      return next(new AppError(`The ${featureName} feature is only available in a higher plan. Please upgrade.`, 403));
    }

    next();
  };
};

module.exports = {
  checkSubscription,
  requireFeature,
};
