'use strict';

const notificationService = require('../../modules/notifications/notification.service');
const emailService = require('./email.service');
const mongoose = require('mongoose');

/**
 * Notifier service centralizes all system notifications (In-app + Email)
 * It respects the system settings for global/event-level toggles.
 */
const notifier = {
  async getSettings() {
    const Settings = mongoose.model('Settings');
    const settings = await Settings.findOne().lean();
    return settings || {};
  },

  async send(userId, { type, title, message, refId, refModel, actionLink, actionLabel, userEmail }) {
    const settings = await this.getSettings();
    const notifSettings = settings.notifications || {};
    const companyName = settings.organization?.companyName || 'CALTIMS';

    // 1. Check event trigger toggle
    const triggerMap = {
      'timesheet_submitted': 'notifyOnTimesheetSubmission',
      'timesheet_approved': 'notifyOnTimesheetApproval',
      'timesheet_rejected': 'notifyOnTimesheetRejection',
      'leave_applied': 'notifyOnLeaveRequest',
      'leave_approved': 'notifyOnLeaveApproval',
      'leave_rejected': 'notifyOnLeaveRejection', // Added for completeness
      'support_ticket_created': 'notifyOnSupportTicket',
    };

    const settingKey = triggerMap[type];
    if (settingKey && notifSettings[settingKey] === false) {
      return { inApp: false, email: false, reason: 'Event trigger disabled' };
    }

    const results = { inApp: false, email: false };

    // 2. In-App Notification
    if (notifSettings.inAppEnabled !== false) {
      await notificationService.create({
        userId,
        type,
        title,
        message,
        refId,
        refModel
      });
      results.inApp = true;
    }

    // 3. Email Notification
    if (notifSettings.emailEnabled !== false && userEmail) {
      try {
        await emailService.sendNotificationEmail(userEmail, {
          title,
          message,
          actionLink,
          actionLabel,
          companyName
        });
        results.email = true;
      } catch (err) {
        console.error(`Failed to send email notification to ${userEmail}:`, err.message);
        results.emailError = err.message;
      }
    }

    // 4. Slack Notification
    const slackSettings = settings.integrations?.slackNotifications || {};
    if (slackSettings.enabled && slackSettings.webhookUrl) {
      try {
        await fetch(slackSettings.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `*${title}*\n${message}${actionLink ? `\n<${actionLink}|${actionLabel || 'View Details'}>` : ''}`,
            username: companyName,
          }),
        });
        results.slack = true;
      } catch (err) {
        console.error('Failed to send Slack notification:', err.message);
        results.slackError = err.message;
      }
    }

    return results;
  }
};

module.exports = notifier;
