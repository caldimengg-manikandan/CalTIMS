'use strict';

const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { logActivity } = require('../../shared/utils/activityLogger');

const subscriptionService = {
  /**
   * Get subscription details for an organization
   */
  async getSubscription(organizationId) {
    if (!organizationId) throw new AppError('Organization ID is required', 400);
    
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      // Create a default trial subscription if it doesn't exist
      subscription = await prisma.subscription.create({
        data: {
          organizationId,
          planType: 'TRIAL',
          status: 'ACTIVE',
          userCount: await prisma.employee.count({ where: { organizationId, isDeleted: false } }),
          pricePerUser: 49, // Trial is like Pro
          totalMonthlyCost: 0, // It's a trial
          trialEndDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
        },
      });
    }

    // Refresh user count if needed
    const currentUserCount = await prisma.employee.count({ 
      where: { organizationId, isDeleted: false } 
    });

    if (subscription.userCount !== currentUserCount) {
      subscription = await prisma.subscription.update({
        where: { organizationId },
        data: { 
          userCount: currentUserCount,
          totalMonthlyCost: subscription.planType === 'TRIAL' ? 0 : currentUserCount * subscription.pricePerUser,
        },
      });
    }

    return subscription;
  },

  /**
   * Get subscription history for an organization
   */
  async getSubscriptionHistory(organizationId) {
    if (!organizationId) throw new AppError('Organization ID is required', 400);

    const history = await prisma.subscriptionHistory.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    // If no history, return a mock entry for the current trial
    if (history.length === 0) {
      const sub = await this.getSubscription(organizationId);
      return [{
        id: 'trial-initial',
        planName: 'Free Trial',
        userCount: sub.userCount,
        pricePerUser: 49,
        totalCost: 0,
        startDate: sub.trialStartDate,
        endDate: sub.trialEndDate,
        status: 'ACTIVE'
      }];
    }

    return history;
  },

  /**
   * Upgrade an organization's subscription plan
   */
  async upgradeSubscription(organizationId, { planType, userId, req }) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new AppError('No subscription found for this organization', 404);
    }

    const oldPlan = subscription.planType;
    const pricePerUser = planType === 'PRO' ? 49 : 29;
    const userCount = await prisma.employee.count({ where: { organizationId, isDeleted: false } });
    const totalMonthlyCost = userCount * pricePerUser;

    // Record history of the old plan
    await prisma.subscriptionHistory.create({
      data: {
        organizationId,
        planName: oldPlan === 'TRIAL' ? 'Free Trial' : oldPlan,
        userCount: subscription.userCount,
        pricePerUser: subscription.pricePerUser,
        totalCost: subscription.totalMonthlyCost,
        startDate: subscription.trialStartDate || subscription.updatedAt,
        endDate: new Date(),
        status: 'COMPLETED',
      },
    });

    const updated = await prisma.subscription.update({
      where: { organizationId },
      data: {
        planType,
        status: 'ACTIVE',
        pricePerUser,
        userCount,
        totalMonthlyCost,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days renewal
        // If upgrading from TRIAL, mark trial as ended
        ...(oldPlan === 'TRIAL' && { trialEndDate: new Date() }),
      },
    });

    // Log the activity
    await logActivity({
      userId,
      organizationId,
      action: 'SUBSCRIPTION_UPGRADE',
      entityType: 'Subscription',
      entityId: updated.id,
      details: { oldPlan, newPlan: planType },
      req,
    });

    return updated;
  },
};

module.exports = subscriptionService;
