'use strict';

const Subscription = require('./subscription.model');
const AppError = require('../../shared/utils/AppError');
const { logActivity } = require('../../shared/utils/activityLogger');

const subscriptionService = {
  /**
   * Upgrade an organization's subscription
   */
  async upgradeSubscription(organizationId, { planType, userId, req }) {
    const subscription = await Subscription.findOne({ organizationId });
    
    if (!subscription) {
      throw new AppError('No subscription found for this organization', 404);
    }

    const oldPlan = subscription.planType;
    subscription.planType = planType;
    subscription.status = 'ACTIVE';
    // If upgrading from TRIAL, we might want to clear trial dates or set them to past
    if (oldPlan === 'TRIAL') {
      subscription.trialEndDate = new Date(); // Effectively ends trial
    }

    await subscription.save();

    // Log the activity
    await logActivity({
      userId,
      organizationId,
      action: 'SUBSCRIPTION_UPGRADE',
      entityType: 'Subscription',
      entityId: subscription._id,
      details: {
        oldPlan,
        newPlan: planType,
      },
      req
    });

    return subscription;
  },

  /**
   * Get subscription details for an organization
   */
  async getSubscription(organizationId) {
    return Subscription.findOne({ organizationId });
  }
};

module.exports = subscriptionService;
