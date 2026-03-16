'use strict';

const cron = require('node-cron');
const Timesheet = require('../../modules/timesheets/timesheet.model');
const User = require('../../modules/users/user.model');
const notificationService = require('../../modules/notifications/notification.service');
const emailService = require('./email.service');
const { TIMESHEET_STATUS, ROLES } = require('../../constants');
const { getWeekStart, getWeekEnd } = require('../../shared/utils/dateHelpers');

let fridayJob = null;
let mondayWarnJob = null;
let mondayFreezeJob = null;

const createTransporter = require('nodemailer').createTransport; // We'll just use emailService directly or a simpler sender. Wait, emailService.sendReportEmail expects specific format. We should add a generic email sender to email.service.js or just write it here if simple.

async function sendSimpleEmail(to, subject, html) {
    try {
        const nodemailer = require('nodemailer');
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return;
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: parseInt(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'CalTIMS'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
    } catch (err) {
        console.error('[Compliance] Error sending email:', err.message);
    }
}

async function handleFridayReminder() {
    console.log('[Compliance] Running Friday 6 PM Reminder');
    const now = new Date();
    const weekStart = getWeekStart(now, 'monday'); // assumption: 'monday' or get from settings. Let's assume monday for scheduling logic

    // Find all active employees
    const employees = await User.find({ role: ROLES.EMPLOYEE, isActive: true }).lean();

    // Find submitted timesheets for this week
    const timesheets = await Timesheet.find({ weekStartDate: weekStart }).lean();
    const submittedIds = new Set(timesheets.filter(ts => ts.status !== TIMESHEET_STATUS.DRAFT).map(ts => ts.userId.toString()));

    for (const emp of employees) {
        if (!submittedIds.has(emp._id.toString())) {
            // Send reminder
            const subject = 'Reminder – Submit your weekly timesheet';
            const body = `
        <p>Hello ${emp.name},</p>
        <p>Our records show that you have not submitted your timesheet for the current week.</p>
        <p>Please submit it before Monday at 6 PM. After this deadline, the timesheet will be automatically frozen and cannot be edited.</p>
        <p>If the timesheet gets frozen, you will need to raise a Help & Support ticket so an admin can assist you.</p>
      `;

            await sendSimpleEmail(emp.email, subject, body);
            await notificationService.create({
                userId: emp._id,
                type: 'timesheet_reminder',
                title: 'Timesheet Reminder',
                message: 'Please submit your timesheet for the current week before Monday at 6 PM.',
            });
        }
    }
}

async function handleMondayWarning() {
    console.log('[Compliance] Running Monday 3 PM Warning');
    const now = new Date();
    const previousWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), 'monday');

    const employees = await User.find({ role: ROLES.EMPLOYEE, isActive: true }).lean();
    const timesheets = await Timesheet.find({ weekStartDate: previousWeekStart }).lean();
    const submittedIds = new Set(timesheets.filter(ts => ts.status !== TIMESHEET_STATUS.DRAFT).map(ts => ts.userId.toString()));

    for (const emp of employees) {
        if (!submittedIds.has(emp._id.toString())) {
            const subject = 'Warning – Submit your previous week timesheet';
            const body = `
        <p>Hello ${emp.name},</p>
        <p>Our records show that you have not submitted your timesheet for the previous week.</p>
        <p>Please submit it before 6 PM today. After this deadline, the timesheet will be automatically frozen and cannot be edited.</p>
        <p>If the timesheet gets frozen, you will need to raise a Help & Support ticket so an admin can assist you.</p>
      `;

            await sendSimpleEmail(emp.email, subject, body);
            await notificationService.create({
                userId: emp._id,
                type: 'timesheet_reminder',
                title: 'Final Timesheet Reminder',
                message: 'Your previous week timesheet will be frozen at 6 PM today. Please submit it now.',
            });
        }
    }
}

async function handleMondayFreeze() {
    console.log('[Compliance] Running Monday 6 PM Freeze');
    const now = new Date();
    const previousWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), 'monday');

    const employees = await User.find({ role: ROLES.EMPLOYEE, isActive: true }).lean();
    const timesheets = await Timesheet.find({ weekStartDate: previousWeekStart });
    const tsMap = new Map(timesheets.map(ts => [ts.userId.toString(), ts]));

    for (const emp of employees) {
        const ts = tsMap.get(emp._id.toString());

        // If timesheet is missing or is draft, freeze it.
        if (!ts) {
            // Create empty frozen timesheet
            const newTs = new Timesheet({
                userId: emp._id,
                weekStartDate: previousWeekStart,
                weekEndDate: getWeekEnd(previousWeekStart, 'monday'),
                status: TIMESHEET_STATUS.FROZEN,
                frozenAt: now,
                rows: []
            });
            await newTs.save();
        } else if (ts.status === TIMESHEET_STATUS.DRAFT) {
            ts.status = TIMESHEET_STATUS.FROZEN;
            ts.frozenAt = now;
            await ts.save();
        }
    }
}

async function handleAuditPurge() {
    console.log('[Compliance] Running Audit Log Purge');
    try {
        const Settings = require('../../modules/settings/settings.model');
        const AuditLog = require('../../modules/audit/audit.model');

        const settings = await Settings.findOne().select('compliance.auditLogRetentionDays').lean();
        const days = settings?.compliance?.auditLogRetentionDays || 365;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
        if (result.deletedCount > 0) {
            console.log(`[Compliance] Purged ${result.deletedCount} audit logs older than ${days} days.`);
        }
    } catch (err) {
        console.error('[Compliance] Audit purge error:', err.message);
    }
}

async function handleMonthlyFreeze() {
    const Settings = require('../../modules/settings/settings.model');
    const settings = await Settings.findOne().select('compliance.timesheetFreezeDay general.weekStartDay').lean();
    const freezeDay = settings?.compliance?.timesheetFreezeDay || 28;
    const wsd = settings?.general?.weekStartDay || 'monday';

    const today = new Date();
    if (today.getDate() !== freezeDay) return;

    console.log(`[Compliance] Running Monthly Freeze (Day ${freezeDay})`);

    // Target: Previous month's weeks
    const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Find timesheets before this month that are not frozen
    const overdueTimesheets = await Timesheet.find({
        weekStartDate: { $lt: firstDayOfCurrentMonth },
        status: { $ne: TIMESHEET_STATUS.FROZEN }
    });

    for (const ts of overdueTimesheets) {
        ts.status = TIMESHEET_STATUS.FROZEN;
        ts.frozenAt = today;
        await ts.save();
    }

    if (overdueTimesheets.length > 0) {
        console.log(`[Compliance] Automatically frozen ${overdueTimesheets.length} historical timesheets.`);
    }
}

let auditJob = null;
let monthlyFreezeJob = null;

const complianceService = {
    startCronJobs() {
        // Friday at 6:00 PM
        if (!fridayJob) {
            fridayJob = cron.schedule('0 18 * * 5', () => {
                handleFridayReminder().catch(err => console.error('[Compliance] Friday reminder error:', err));
            });
        }

        // Monday at 3:00 PM
        if (!mondayWarnJob) {
            mondayWarnJob = cron.schedule('0 15 * * 1', () => {
                handleMondayWarning().catch(err => console.error('[Compliance] Monday warning error:', err));
            });
        }

        // Monday at 6:00 PM
        if (!mondayFreezeJob) {
            mondayFreezeJob = cron.schedule('0 18 * * 1', () => {
                handleMondayFreeze().catch(err => console.error('[Compliance] Monday freeze error:', err));
            });
        }

        // Daily at Midnight: Audit Purge & Monthly Freeze Check
        if (!auditJob) {
            auditJob = cron.schedule('0 0 * * *', () => {
                handleAuditPurge().catch(err => console.error('[Compliance] Audit purge error:', err));
                handleMonthlyFreeze().catch(err => console.error('[Compliance] Monthly freeze error:', err));
            });
        }

        console.log('[Compliance] ✅ Timesheet compliance scheduler started (Weekly + Monthly).');
    },

    stopCronJobs() {
        if (fridayJob) { fridayJob.stop(); fridayJob = null; }
        if (mondayWarnJob) { mondayWarnJob.stop(); mondayWarnJob = null; }
        if (mondayFreezeJob) { mondayFreezeJob.stop(); mondayFreezeJob = null; }
        if (auditJob) { auditJob.stop(); auditJob = null; }
    }
};

module.exports = complianceService;
