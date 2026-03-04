'use strict';

/**
 * Scheduler Service
 * Runs a cron job every minute, checks active ReportSchedules,
 * and fires emails when the schedule is due.
 */

const cron = require('node-cron');
const ReportSchedule = require('../../modules/reportSchedules/reportSchedule.model');
const User = require('../../modules/users/user.model');
const emailService = require('./email.service');
const Settings = require('../../modules/settings/settings.model');

let _job = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine if a schedule is due to fire right now.
 * Called once per minute; "due" means today + this HH:mm + within the window.
 */
function isDue(schedule, now) {
  const [hh, mm] = (schedule.scheduledTime || '09:00').split(':').map(Number);
  if (now.getHours() !== hh || now.getMinutes() !== mm) return false;

  const last = schedule.lastSentAt ? new Date(schedule.lastSentAt) : null;
  if (!last) return true; // Never sent — fire immediately

  const diffMs = now - last;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (schedule.frequency) {
    case 'daily':       return diffDays >= 1;
    case 'weekly':      return diffDays >= 7;
    case 'fortnightly': return diffDays >= 14;
    case 'monthly':     return diffDays >= 28;
    default:            return false;
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────
async function runScheduler() {
  const now = new Date();

  let schedules;
  try {
    schedules = await ReportSchedule.find({ isActive: true }).lean();
  } catch (err) {
    console.error('[Scheduler] DB error fetching schedules:', err.message);
    return;
  }

  for (const schedule of schedules) {
    if (!isDue(schedule, now)) continue;

    // Fetch company name
    let companyName = 'TIMS';
    try {
      const settings = await Settings.findOne().lean();
      companyName = settings?.general?.companyName || companyName;
    } catch (_) {}

    // Fetch recipient emails
    let emails = [];
    try {
      if (schedule.recipientIds?.length) {
        const users = await User.find({ _id: { $in: schedule.recipientIds } }, 'email').lean();
        emails = users.map(u => u.email).filter(Boolean);
      }
    } catch (err) {
      console.error(`[Scheduler] Error fetching recipients for "${schedule.name}":`, err.message);
    }

    if (!emails.length) {
      console.warn(`[Scheduler] Schedule "${schedule.name}" has no recipients — skipping.`);
      continue;
    }

    // Send email
    let historyEntry;
    try {
      const result = await emailService.sendReportEmail(
        emails,
        schedule.reportType,
        companyName,
        schedule.projectIds || []
      );
      historyEntry = {
        sentAt: now,
        status: 'success',
        recipientCount: result.sent,
        reportTitle: result.reportTitle,
        error: null,
      };
      console.log(`[Scheduler] ✅ Sent "${schedule.name}" → ${result.sent} recipient(s)`);
    } catch (err) {
      historyEntry = {
        sentAt: now,
        status: 'failed',
        recipientCount: 0,
        reportTitle: schedule.reportType,
        error: err.message,
      };
      console.error(`[Scheduler] ❌ Failed "${schedule.name}":`, err.message);
    }

    // Persist history + lastSentAt
    try {
      const doc = await ReportSchedule.findById(schedule._id);
      if (doc) await doc.addHistory(historyEntry);
    } catch (err) {
      console.error(`[Scheduler] Error saving history for "${schedule.name}":`, err.message);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
const schedulerService = {
  start() {
    if (_job) return;
    _job = cron.schedule('* * * * *', () => {
      runScheduler().catch(err => console.error('[Scheduler] Unhandled error:', err.message));
    });
    console.log('[Scheduler] ✅ Report scheduler started — checking every minute.');
  },

  stop() {
    if (_job) { _job.stop(); _job = null; }
  },
};

module.exports = schedulerService;
