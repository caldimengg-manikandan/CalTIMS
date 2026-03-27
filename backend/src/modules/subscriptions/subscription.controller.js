'use strict';

const subscriptionService = require('./subscription.service');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const AppError = require('../../shared/utils/AppError');

const subscriptionController = {
  /**
   * Upgrade subscription plan
   */
  upgrade: asyncHandler(async (req, res) => {
    const { planType } = req.body;
    const { organizationId, _id: userId } = req.user;

    if (!['BASIC', 'PRO'].includes(planType)) {
      throw new AppError('Invalid plan type. Must be BASIC or PRO.', 400);
    }

    if (!organizationId) {
      throw new AppError('User is not associated with an organization', 403);
    }

    const subscription = await subscriptionService.upgradeSubscription(organizationId, {
      planType,
      userId,
      req
    });

    ApiResponse.success(res, {
      message: `Successfully upgraded to ${planType} plan`,
      data: subscription
    });
  }),

  /**
   * Get current subscription
   */
  getCurrent: asyncHandler(async (req, res) => {
    const { organizationId } = req.user;
    if (!organizationId) {
      throw new AppError('User is not associated with an organization', 403);
    }

    const subscription = await subscriptionService.getSubscription(organizationId);
    ApiResponse.success(res, { data: subscription });
  }),
};

module.exports = subscriptionController;
