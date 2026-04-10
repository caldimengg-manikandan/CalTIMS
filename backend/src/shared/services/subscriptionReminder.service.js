'use strict';

const { prisma } = require('../../config/database');
const emailService = require('./email.service');
const { ROLES } = require('../../constants');

const subscriptionReminderService = {
  async checkTrialReminders() {
    const now = new Date();
    const activeTrials = await prisma.subscription.findMany({
      where: { planType: 'TRIAL', status: 'ACTIVE' },
    });

    console.log(`[SubscriptionReminder] Checking ${activeTrials.length} active trials...`);

    for (const subscription of activeTrials) {
      try {
        const trialEndDate = new Date(subscription.trialEndDate);
        const diffDays = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));

        const admin = await prisma.user.findFirst({
          where: { 
            organizationId: subscription.organizationId, 
            isOwner: true,
            isActive: true 
          },
        });

        if (!admin) {
          console.warn(`[SubscriptionReminder] No admin found for org ${subscription.organizationId}`);
          continue;
        }

        if (diffDays <= 0 && !subscription.notifiedExpired) {
          await this.sendExpirationNotice(admin, subscription);
        } else if (diffDays === 3 && !subscription.notified3Days) {
          await this.sendReminder(admin, subscription, 3);
          await prisma.subscription.update({ where: { id: subscription.id }, data: { notified3Days: true } });
        } else if (diffDays === 8 && !subscription.notified8Days) {
          await this.sendReminder(admin, subscription, 8);
          await prisma.subscription.update({ where: { id: subscription.id }, data: { notified8Days: true } });
        }
      } catch (err) {
        console.error(`[SubscriptionReminder] Error processing subscription ${subscription.id}:`, err.message);
      }
    }
  },

  async sendReminder(admin, subscription, daysLeft) {
    const title = `Your CALTIMS trial expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
    const message = `Hello ${admin.name},<br><br>Your free trial of CALTIMS will expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. Please upgrade to ensure uninterrupted access.`;
    await emailService.sendNotificationEmail(admin.email, { title, message, actionLink: `${process.env.CLIENT_URL}/settings?tab=subscription`, actionLabel: 'Upgrade Now' });
    console.log(`[SubscriptionReminder] Sent ${daysLeft}-day reminder to ${admin.email}`);
  },

  async sendExpirationNotice(admin, subscription) {
    const title = 'Your CALTIMS trial has expired';
    const message = `Hello ${admin.name},<br><br>Your 28-day trial of CALTIMS has expired. Please upgrade to regain access.`;
    await emailService.sendNotificationEmail(admin.email, { title, message, actionLink: `${process.env.CLIENT_URL}/settings?tab=subscription`, actionLabel: 'Upgrade Now' });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED', notifiedExpired: true } });
    console.log(`[SubscriptionReminder] Sent expiration notice to ${admin.email}`);
  },
};

module.exports = subscriptionReminderService;
