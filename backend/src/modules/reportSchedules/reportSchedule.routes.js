'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { prisma } = require('../../config/database');
const emailService = require('../../shared/services/email.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager'));

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getCompanyName(organizationId) {
  const s = await prisma.systemSetting.findFirst({ where: { organizationId, key: 'companyName' } });
  return s?.value || 'TimesheetPro';
}

// ── GET /api/v1/report-schedules — list all ──────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const schedules = await prisma.reportSchedule.findMany({
    where: { organizationId: req.organizationId },
    orderBy: { createdAt: 'desc' }
  });
  
  // Enforce manual recipient enrichment since we don't have populate
  const userIds = [...new Set(schedules.flatMap(s => s.recipientIds))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true }
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const enrichedSchedules = schedules.map(s => ({
    ...s,
    recipientIds: s.recipientIds.map(rid => userMap[rid] || rid)
  }));

  ApiResponse.success(res, { data: enrichedSchedules });
}));

// ── POST /api/v1/report-schedules — create ───────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { name, frequency, scheduledTime, reportType, recipientIds, projectIds, isActive } = req.body;

  if (!name?.trim()) {
    return ApiResponse.error(res, { message: 'Schedule name is required', statusCode: 400 });
  }
  if (!recipientIds?.length) {
    return ApiResponse.error(res, { message: 'At least one recipient is required', statusCode: 400 });
  }

  const schedule = await prisma.reportSchedule.create({
    data: {
      name: name.trim(),
      frequency: frequency || 'weekly',
      scheduledTime: scheduledTime || '09:00',
      reportType: reportType || 'approved',
      recipientIds: recipientIds || [],
      projectIds: projectIds || [],
      isActive: isActive !== false,
      createdById: req.user.id,
      organizationId: req.organizationId,
    }
  });

  ApiResponse.success(res, { message: 'Schedule created', data: schedule, statusCode: 201 });
}));

// ── PUT /api/v1/report-schedules/:id — update ────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const { name, frequency, scheduledTime, reportType, recipientIds, projectIds, isActive } = req.body;

  const schedule = await prisma.reportSchedule.update({
    where: { id_organizationId: { id: req.params.id, organizationId: req.organizationId } },
    data: {
      name: name?.trim(),
      frequency,
      scheduledTime,
      reportType,
      recipientIds,
      projectIds,
      isActive
    }
  });

  ApiResponse.success(res, { message: 'Schedule updated', data: schedule });
}));

// ── DELETE /api/v1/report-schedules/:id — delete (stops auto-send) ───────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const schedule = await prisma.reportSchedule.delete({
    where: { id_organizationId: { id: req.params.id, organizationId: req.organizationId } }
  });
  if (!schedule) return ApiResponse.notFound(res, 'Schedule not found');
  ApiResponse.success(res, { message: 'Schedule deleted. Auto-send has been stopped.' });
}));

// ── POST /api/v1/report-schedules/:id/send-now — manual fire ─────────────────
router.post('/:id/send-now', asyncHandler(async (req, res) => {
  const schedule = await prisma.reportSchedule.findUnique({
    where: { id_organizationId: { id: req.params.id, organizationId: req.organizationId } }
  });
  if (!schedule) return ApiResponse.notFound(res, 'Schedule not found');

  const users = await prisma.user.findMany({
    where: { id: { in: schedule.recipientIds }, organizationId: req.organizationId },
    select: { email: true, name: true }
  });
  const emails = users.map(u => u.email).filter(Boolean);

  if (!emails.length) {
    return ApiResponse.error(res, { message: 'No valid email recipients found', statusCode: 400 });
  }

  const companyName = await getCompanyName(req.organizationId);
  
  const settings = await prisma.orgSettings.findUnique({ where: { organizationId: req.organizationId } });
  const format = settings?.data?.report?.defaultFormat || 'PDF';

  try {
    result = await emailService.sendReportEmail(emails, schedule.reportType, companyName, schedule.projectIds || [], format, req.organizationId);
    
    // Save success history
    const history = Array.isArray(schedule.history) ? schedule.history : [];
    history.push({ date: new Date(), status: 'success', recipientCount: result.sent, reportTitle: result.reportTitle });
    
    await prisma.reportSchedule.update({
        where: { id_organizationId: { id: schedule.id, organizationId: req.organizationId } },
        data: { history, lastSentAt: new Date() }
    });
  } catch (err) {
    // Save failed history
    const history = Array.isArray(schedule.history) ? schedule.history : [];
    history.push({ date: new Date(), status: 'failed', recipientCount: 0, reportTitle: schedule.reportType, error: err.message });
    
    await prisma.reportSchedule.update({
        where: { id_organizationId: { id: schedule.id, organizationId: req.organizationId } },
        data: { history }
    });

    return ApiResponse.error(res, {
      message: err.message.includes('SMTP') ? 'SMTP not configured. Check .env file.' : `Email failed: ${err.message}`,
      statusCode: 400,
    });
  }

  ApiResponse.success(res, { message: `Report sent to ${result.sent} recipient(s)`, data: result });
}));

// ── GET /api/v1/report-schedules/:id/history — history for one schedule ──────
router.get('/:id/history', asyncHandler(async (req, res) => {
  const schedule = await prisma.reportSchedule.findUnique({
    where: { id_organizationId: { id: req.params.id, organizationId: req.organizationId } },
    select: { name: true, history: true }
  });
  if (!schedule) return ApiResponse.notFound(res, 'Schedule not found');
  ApiResponse.success(res, { data: schedule.history });
}));

// ── POST /api/v1/report-schedules/preview — preview HTML ─────────────────────
router.post('/preview', asyncHandler(async (req, res) => {
  const { reportType = 'approved', projectIds = [] } = req.body;
  const companyName = await getCompanyName(req.organizationId);
  try {
    const preview = await emailService.buildPreview(reportType, companyName, projectIds, req.organizationId);
    ApiResponse.success(res, { data: preview });
  } catch (err) {
    ApiResponse.error(res, { message: `Preview failed: ${err.message}`, statusCode: 500 });
  }
}));

// ── POST /api/v1/report-schedules/preview/pdf — download PDF ─────────────────
router.post('/preview/pdf', asyncHandler(async (req, res) => {
  const { reportType = 'approved', projectIds = [] } = req.body;
  const companyName = await getCompanyName(req.organizationId);
  try {
    const { buffer, reportTitle } = await emailService.buildReportPdf(reportType, companyName, projectIds, req.organizationId);
    const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
    const fileName = `${reportTitle.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    ApiResponse.error(res, { message: `PDF generation failed: ${err.message}`, statusCode: 500 });
  }
}));

// ── POST /api/v1/report-schedules/preview/send-pdf — email PDF to recipients ─
router.post('/preview/send-pdf', asyncHandler(async (req, res) => {
  const { reportType = 'approved', projectIds = [], recipientEmails = [] } = req.body;
  if (!recipientEmails.length) {
    return ApiResponse.error(res, { message: 'At least one recipient email is required', statusCode: 400 });
  }
  const companyName = await getCompanyName(req.organizationId);
  try {
    const result = await emailService.sendReportPdfEmail(recipientEmails, reportType, companyName, projectIds, req.organizationId);
    ApiResponse.success(res, { message: `PDF report sent to ${result.sent} recipient(s)`, data: result });
  } catch (err) {
    const msg = err.message.includes('SMTP') ? 'SMTP not configured. Check .env file.' : `Send failed: ${err.message}`;
    ApiResponse.error(res, { message: msg, statusCode: 400 });
  }
}));

module.exports = router;
