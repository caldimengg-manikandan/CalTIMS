const { prisma } = require('../../config/database');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');

const adminController = {
  getDashboardMetrics: asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalOrgs,
      trialSub,
      basicSub,
      proSub,
      activeToday
    ] = await Promise.all([
      prisma.user.count({ where: { role: { not: 'super_admin' } } }),
      prisma.organization.count({ where: { isDeleted: false } }),
      prisma.subscription.count({ where: { planType: 'TRIAL' } }),
      prisma.subscription.count({ where: { planType: 'BASIC' } }),
      prisma.subscription.count({ where: { planType: 'PRO' } }),
      prisma.user.count({ where: { lastLogin: { gte: today } } })
    ]);

    ApiResponse.success(res, {
      data: {
        total_users: totalUsers,
        total_organizations: totalOrgs,
        trial_users: trialSub,
        basic_users: basicSub,
        pro_users: proSub,
        active_users_today: activeToday
      }
    });
  }),

  // Global admin: List all organizations with their plans
  getAllOrganizations: asyncHandler(async (req, res) => {
    const organizations = await prisma.organization.findMany({
      where: { isDeleted: false },
      include: {
        subscriptions: true // In schema it's an array
      }
    });

    const formatted = organizations.map(org => ({
      ...org,
      subscription: org.subscriptions ? org.subscriptions[0] : null
    }));

    ApiResponse.success(res, { data: formatted });
  }),
};

module.exports = adminController;
