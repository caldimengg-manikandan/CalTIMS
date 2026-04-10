'use strict';

const { prisma } = require('../config/database');
const { PLAN_FEATURES } = require('../constants/plans');
const AppError = require('../shared/utils/AppError');
const asyncHandler = require('../shared/utils/asyncHandler');
const { ROLES } = require('../constants');

/**
 * Middleware to check if organization subscription is active and not expired
 */
const checkSubscription = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // Super Admin bypass
  if (user.role === ROLES.SUPER_ADMIN || user.role === 'super_admin') {
    return next();
  }

  // Onboarding/Public bypass: Always allow users to see their own profile and basic settings 
  // (needed for onboarding flow)
  const bypassPaths = [
    '/users/me',
    '/settings/general',
    '/auth/onboarding',
    '/settings/public'
  ];
  
  const currentPath = req.path.toLowerCase();
  const originalUrl = req.originalUrl.toLowerCase().split('?')[0];

  const isBypass = bypassPaths.some(p => {
    const lowP = p.toLowerCase();
    return currentPath === lowP || 
           currentPath === lowP + '/' || 
           originalUrl.includes(lowP);
  });

  if (isBypass) {
    return next();
  }

  if (!user.organizationId) {
    return next(new AppError('User not associated with any organization', 403));
  }

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: user.organizationId },
  });

  if (!subscription) {
    return next(new AppError('No active subscription found for your organization', 403));
  }

  // Trial Expiry Check
  if (subscription.planType === 'TRIAL' && subscription.trialEndDate) {
    if (new Date() > new Date(subscription.trialEndDate)) {
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } });
      return next(new AppError('Your free trial has expired. Please upgrade to continue.', 403));
    }
  }

  // Status Check
  if (subscription.status !== 'ACTIVE') {
    return next(new AppError(`Subscription is ${subscription.status.toLowerCase()}. Please contact support.`, 403));
  }

  req.subscription = subscription;
  next();
});

/**
 * Middleware to restrict access to features based on subscription plan
 */
const requireFeature = (featureName) => {
  return (req, res, next) => {
    const user = req.user;

    if (user.role === ROLES.SUPER_ADMIN || user.role === 'super_admin') return next();

    const subscription = req.subscription;
    if (!subscription) return next(new AppError('Authentication required to verify features', 401));

    const features = PLAN_FEATURES[subscription.planType];
    if (!features || !features[featureName]) {
      return next(new AppError(`The ${featureName} feature is only available in a higher plan. Please upgrade.`, 403));
    }

    next();
  };
};

module.exports = { checkSubscription, requireFeature };
