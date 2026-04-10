'use strict';

const cron = require('node-cron');
const { prisma } = require('../../config/database');
const emailService = require('./email.service');
const subscriptionReminderService = require('./subscriptionReminder.service');

let _job = null;
let _reminderJob = null;

function isDue(schedule, now) {
  const [hh, mm] = (schedule.scheduledTime || '09:00').split(':').map(Number);
  if (now.getHours() !== hh || now.getMinutes() !== mm) return false;

  const last = schedule.lastSentAt ? new Date(schedule.lastSentAt) : null;
  if (!last) return true;

  const diffDays = (now - last) / (1000 * 60 * 60 * 24);
  switch (schedule.frequency) {
    case 'daily':       return diffDays >= 1;
    case 'weekly':      return diffDays >= 7;
    case 'fortnightly': return diffDays >= 14;
    case 'monthly':     return diffDays >= 28;
    default:            return false;
  }
}

async function runScheduler() {
  const now = new Date();

  let schedules;
  try {
    schedules = await prisma.reportSchedule.findMany({ where: { isActive: true } });
  } catch (err) {
    console.error('[Scheduler] DB error fetching schedules:', err.message);
    return;
  }

  for (const schedule of schedules) {
    if (!isDue(schedule, now)) continue;

    // Fetch org settings for company name and format
    let companyName = 'CALTIMS';
    let format = 'PDF';
    try {
      if (schedule.organizationId) {
        const s = await prisma.orgSettings.findUnique({ where: { organizationId: schedule.organizationId } });
        companyName = s?.data?.general?.companyName || companyName;
        format = s?.data?.report?.defaultFormat || format;
      }
    } catch (_) {}

    // Fetch recipient emails
    let emails = [];
    try {
      if (schedule.recipientIds?.length) {
        const users = await prisma.user.findMany({
          where: { id: { in: schedule.recipientIds } },
          select: { email: true },
        });
        emails = users.map(u => u.email).filter(Boolean);
      }
    } catch (err) {
      console.error(`[Scheduler] Error fetching recipients for "${schedule.name}":`, err.message);
    }

    if (!emails.length) {
      console.warn(`[Scheduler] Schedule "${schedule.name}" has no recipients — skipping.`);
      continue;
    }

    let historyEntry;
    try {
      const result = await emailService.sendReportEmail(emails, schedule.reportType, companyName, schedule.projectIds || [], format);
      historyEntry = { sentAt: now, status: 'success', recipientCount: result.sent, reportTitle: result.reportTitle, error: null };
      console.log(`[Scheduler] ✅ Sent "${schedule.name}" → ${result.sent} recipient(s)`);
    } catch (err) {
      historyEntry = { sentAt: now, status: 'failed', recipientCount: 0, reportTitle: schedule.reportType, error: err.message };
      console.error(`[Scheduler] ❌ Failed "${schedule.name}":`, err.message);
    }

    // Persist history + lastSentAt
    try {
      const existing = await prisma.reportSchedule.findUnique({ where: { id: schedule.id } });
      if (existing) {
        const history = [historyEntry, ...(existing.history || [])].slice(0, 50);
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastSentAt: now, history },
        });
      }
    } catch (err) {
      console.error(`[Scheduler] Error saving history for "${schedule.name}":`, err.message);
    }
  }
}

const schedulerService = {
  start() {
    if (_job) return;
    _job = cron.schedule('* * * * *', () => {
      runScheduler().catch(err => console.error('[Scheduler] Unhandled error:', err.message));
    });

    _reminderJob = cron.schedule('0 * * * *', () => {
      subscriptionReminderService.checkTrialReminders().catch(err => console.error('[SubscriptionReminder] Unhandled error:', err.message));
    });

    console.log('[Scheduler] ✅ Report scheduler started — checking every minute.');
    console.log('[Scheduler] ✅ Subscription reminders started — checking every hour.');
  },

  stop() {
    if (_job) { _job.stop(); _job = null; }
    if (_reminderJob) { _reminderJob.stop(); _reminderJob = null; }
  },
};

module.exports = schedulerService;
