'use strict';

const User = require('../users/user.model');
const Organization = require('../organizations/organization.model');
const Subscription = require('../subscriptions/subscription.model');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');

const adminController = {
  getDashboardMetrics: asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalOrgs,
      trialUsers,
      basicUsers,
      proUsers,
      activeToday
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'super_admin' } }),
      Organization.countDocuments(),
      Subscription.countDocuments({ planType: 'TRIAL' }),
      Subscription.countDocuments({ planType: 'BASIC' }),
      Subscription.countDocuments({ planType: 'PRO' }),
      User.countDocuments({ lastLogin: { $gte: today } })
    ]);

    ApiResponse.success(res, {
      data: {
        total_users: totalUsers,
        total_organizations: totalOrgs,
        trial_users: trialUsers,
        basic_users: basicUsers,
        pro_users: proUsers,
        active_users_today: activeToday
      }
    });
  }),

  // Add more admin features as needed (e.g. list organizations, upgrade/downgrade orgs manually)
  getAllOrganizations: asyncHandler(async (req, res) => {
    const organizations = await Organization.find();
    const orgsWithSub = await Promise.all(organizations.map(async org => {
      const subscription = await Subscription.findOne({ organizationId: org._id });
      return {
        ...org.toObject(),
        subscription
      };
    }));
    ApiResponse.success(res, { data: orgsWithSub });
  }),
};

module.exports = adminController;
