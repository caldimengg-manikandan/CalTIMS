'use strict';

const cron = require('node-cron');
const { prisma } = require('../../config/database');
const notificationService = require('../../modules/notifications/notification.service');
const { ROLES } = require('../../constants');
const { getWeekStart, getWeekEnd } = require('../../shared/utils/dateHelpers');

let fridayJob = null;
let mondayWarnJob = null;
let mondayFreezeJob = null;
let auditJob = null;

async function sendSimpleEmail(to, subject, html) {
  try {
    const nodemailer = require('nodemailer');
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
  const employees = await prisma.user.findMany({
    where: { role: ROLES.EMPLOYEE, isActive: true },
    select: { id: true, name: true, email: true, organizationId: true },
  });

  for (const emp of employees) {
    await sendSimpleEmail(emp.email, 'Reminder – Submit your weekly timesheet', `<p>Hello ${emp.name},</p><p>Please submit your timesheet for the current week before Monday at 6 PM.</p>`);
    if (emp.organizationId) {
      await notificationService.create({ userId: emp.id, type: 'timesheet_submitted', title: 'Timesheet Reminder', message: 'Please submit your timesheet for the current week before Monday at 6 PM.', organizationId: emp.organizationId });
    }
  }
}

async function handleMondayWarning() {
  console.log('[Compliance] Running Monday 3 PM Warning');
  const employees = await prisma.user.findMany({
    where: { role: ROLES.EMPLOYEE, isActive: true },
    select: { id: true, name: true, email: true, organizationId: true },
  });

  for (const emp of employees) {
    await sendSimpleEmail(emp.email, 'Warning – Submit your previous week timesheet', `<p>Hello ${emp.name},</p><p>Your previous week timesheet will be frozen at 6 PM today. Please submit it now.</p>`);
    if (emp.organizationId) {
      await notificationService.create({ userId: emp.id, type: 'timesheet_submitted', title: 'Final Timesheet Reminder', message: 'Your previous week timesheet will be frozen at 6 PM today.', organizationId: emp.organizationId });
    }
  }
}

async function handleMondayFreeze() {
  console.log('[Compliance] Running Monday 6 PM Freeze');
  const now = new Date();
  // Lock timesheets in DRAFT status that are from previous weeks
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  await prisma.timesheet.updateMany({
    where: { status: 'DRAFT', workDate: { lt: cutoff } },
    data: { isLocked: true, status: 'SUBMITTED' },
  });
}

async function handleAuditPurge() {
  console.log('[Compliance] Running Audit Log Purge');
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (result.count > 0) console.log(`[Compliance] Purged ${result.count} audit logs older than 365 days.`);
  } catch (err) {
    console.error('[Compliance] Audit purge error:', err.message);
  }
}

const complianceService = {
  startCronJobs() {
    if (!fridayJob) fridayJob = cron.schedule('0 18 * * 5', () => handleFridayReminder().catch(err => console.error('[Compliance] Friday error:', err)));
    if (!mondayWarnJob) mondayWarnJob = cron.schedule('0 15 * * 1', () => handleMondayWarning().catch(err => console.error('[Compliance] Monday warn error:', err)));
    if (!mondayFreezeJob) mondayFreezeJob = cron.schedule('0 18 * * 1', () => handleMondayFreeze().catch(err => console.error('[Compliance] Monday freeze error:', err)));
    if (!auditJob) auditJob = cron.schedule('0 0 * * *', () => handleAuditPurge().catch(err => console.error('[Compliance] Audit purge error:', err)));
    console.log('[Compliance] ✅ Compliance scheduler started.');
  },

  stopCronJobs() {
    if (fridayJob) { fridayJob.stop(); fridayJob = null; }
    if (mondayWarnJob) { mondayWarnJob.stop(); mondayWarnJob = null; }
    if (mondayFreezeJob) { mondayFreezeJob.stop(); mondayFreezeJob = null; }
    if (auditJob) { auditJob.stop(); auditJob = null; }
  },
};

module.exports = complianceService;
