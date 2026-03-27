'use strict';

const Subscription = require('../../modules/subscriptions/subscription.model');
const User = require('../../modules/users/user.model');
const emailService = require('./email.service');
const { ROLES } = require('../../constants');

const subscriptionReminderService = {
  /**
   * Check all active trials and send reminder emails based on remaining days.
   */
  async checkTrialReminders() {
    const now = new Date();
    const activeTrials = await Subscription.find({
      planType: 'TRIAL',
      status: 'ACTIVE'
    });

    console.log(`[SubscriptionReminder] Checking ${activeTrials.length} active trials...`);

    for (const subscription of activeTrials) {
      try {
        const trialEndDate = new Date(subscription.trialEndDate);
        const diffTime = trialEndDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Find the organization admin to notify
        const admin = await User.findOne({ 
          organizationId: subscription.organizationId, 
          role: ROLES.ADMIN 
        });

        if (!admin) {
          console.warn(`[SubscriptionReminder] No admin found for organization ${subscription.organizationId}`);
          continue;
        }

        // 1. Expiration (0 or fewer days)
        if (diffDays <= 0) {
          await this.sendExpirationNotice(admin, subscription);
          continue;
        }

        // 2. 1 Day Remaining
        if (diffDays === 1 && !subscription.notified1Day) {
          await this.sendReminder(admin, subscription, 1);
          subscription.notified1Day = true;
          await subscription.save();
          continue;
        }

        // 3. 7 Days Remaining
        if (diffDays <= 7 && diffDays > 1 && !subscription.notified7Days) {
          await this.sendReminder(admin, subscription, 7);
          subscription.notified7Days = true;
          await subscription.save();
          continue;
        }

      } catch (err) {
        console.error(`[SubscriptionReminder] Error processing subscription ${subscription._id}:`, err.message);
      }
    }
  },

  /**
   * Send a reminder email for upcoming trial expiration.
   */
  async sendReminder(admin, subscription, daysLeft) {
    const title = `Your CALTIMS trial expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
    const message = `
      Hello ${admin.name},<br><br>
      This is a friendly reminder that your free trial of CALTIMS will expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. 
      To ensure uninterrupted access for your team, please choose a subscription plan.<br><br>
      Don't worry, all your data will be saved!
    `;

    await emailService.sendNotificationEmail(admin.email, {
      title,
      message,
      actionLink: `${process.env.CLIENT_URL}/settings?tab=subscription`,
      actionLabel: 'Upgrade Now'
    });

    console.log(`[SubscriptionReminder] Sent ${daysLeft}-day reminder to ${admin.email}`);
  },

  /**
   * Send final expiration notice and update subscription status.
   */
  async sendExpirationNotice(admin, subscription) {
    const title = 'Your CALTIMS trial has expired';
    const message = `
      Hello ${admin.name},<br><br>
      Your 28-day trial of CALTIMS has expired. Your account access has been restricted.<br><br>
      To regain access to your timesheets, reports, and team management, please upgrade to a paid plan. 
      Your data is safe and will be available as soon as you upgrade.
    `;

    await emailService.sendNotificationEmail(admin.email, {
      title,
      message,
      actionLink: `${process.env.CLIENT_URL}/settings?tab=subscription`,
      actionLabel: 'Upgrade Now'
    });

    subscription.status = 'EXPIRED';
    subscription.notifiedExpired = true;
    await subscription.save();

    console.log(`[SubscriptionReminder] Sent expiration notice to ${admin.email} and locked subscription.`);
  }
};

module.exports = subscriptionReminderService;
