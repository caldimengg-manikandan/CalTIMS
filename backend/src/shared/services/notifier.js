'use strict';

const notificationService = require('../../modules/notifications/notification.service');
const emailService = require('./email.service');
const { prisma } = require('../../config/database');

const notifier = {
  async getSettings(organizationId) {
    if (!organizationId) return {};
    const s = await prisma.orgSettings.findUnique({ where: { organizationId } });
    return s?.data || {};
  },

  async send(userId, { type, title, message, refId, refModel, actionLink, actionLabel, userEmail, organizationId }) {
    if (!organizationId) {
      console.warn(`[Notifier] Sending notification ${type} without organizationId to user ${userId}`);
    }
    const settings = await this.getSettings(organizationId);
    const notifSettings = settings.notifications || {};
    const companyName = settings.organization?.companyName || 'CALTIMS';

    const triggerMap = {
      'timesheet_submitted': 'notifyOnTimesheetSubmission',
      'timesheet_approved': 'notifyOnTimesheetApproval',
      'timesheet_rejected': 'notifyOnTimesheetRejection',
      'leave_applied': 'notifyOnLeaveRequest',
      'leave_approved': 'notifyOnLeaveApproval',
      'leave_rejected': 'notifyOnLeaveRejection',
      'support_ticket_created': 'notifyOnSupportTicket',
    };

    const settingKey = triggerMap[type];
    if (settingKey && notifSettings[settingKey] === false) {
      return { inApp: false, email: false, reason: 'Event trigger disabled' };
    }

    const results = { inApp: false, email: false };

    if (notifSettings.inAppEnabled !== false) {
      await notificationService.create({ userId, type, title, message, refId, refModel, organizationId });
      results.inApp = true;
    }

    if (notifSettings.emailEnabled !== false && userEmail) {
      try {
        await emailService.sendNotificationEmail(userEmail, { title, message, actionLink, actionLabel, companyName });
        results.email = true;
      } catch (err) {
        results.emailError = err.message;
      }
    }

    // Slack
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
        results.slackError = err.message;
      }
    }

    return results;
  },
};

module.exports = notifier;
