'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const leaveService = require('./leave.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');

router.use(authenticate);
router.use(checkSubscription);
router.use(requireFeature('leave_management'));

router.post('/', asyncHandler(async (req, res) => {
  const leave = await leaveService.apply(req.body, req.context);
  ApiResponse.created(res, { message: 'Leave application submitted', data: leave });
}));

router.get('/', asyncHandler(async (req, res) => {
  const result = await leaveService.getAll(req.query, req.context);
  ApiResponse.success(res, result);
}));

// ── GET all approved leaves for calendar display (visible to all users) ────────
router.get('/calendar', asyncHandler(async (req, res) => {
  const { prisma } = require('../../config/database');
  const { from, to } = req.query;
  const where = { status: 'APPROVED', organizationId: req.organizationId, isDeleted: false };

  if (from || to) {
    const fromDate = from ? new Date(from) : new Date('2000-01-01');
    const toDate   = to   ? new Date(to)   : new Date('9999-12-31');
    where.startDate = { lte: toDate };
    where.endDate   = { gte: fromDate };
  }

  const leaves = await prisma.leave.findMany({
    where,
    include: { employee: { include: { user: { select: { id: true, name: true } } } }, type: true },
    orderBy: { startDate: 'asc' }
  });

  const leaveTypeColors = {
    annual:    '#f59e0b',
    sick:      '#ef4444',
    casual:    '#8b5cf6',
    unpaid:    '#6b7280',
    maternity: '#ec4899',
    paternity: '#06b6d4',
  };

  const events = leaves.map(leave => ({
    id:        leave.id,
    title:     `${leave.employee?.user?.name || 'Employee'}`,
    startDate: leave.startDate,
    endDate:   leave.endDate,
    isAllDay:  true,
    isPublic:  true,
    isLeave:   true,
    color:     leave.type?.color || leaveTypeColors[leave.type?.name?.toLowerCase()] || '#f59e0b',
    leaveType: leave.type?.name,
    employee:  leave.employee?.user,
    totalDays: leave.totalDays,
    createdBy: leave.employee?.userId,
  }));

  ApiResponse.success(res, { data: events });
}));

// ── Backfill route MUST be before /:id routes to avoid param conflict ──────────
router.post('/backfill-timesheets', checkPermission('Leave Management', 'Leave Requests', 'approve'), asyncHandler(async (req, res) => {
  const result = await leaveService.backfillTimesheets(req.user._id, req.organizationId);
  ApiResponse.success(res, {
    message: `Synced ${result.synced}/${result.total} approved leaves to timesheets`,
    data: result
  });
}));

router.get('/filter-options', checkPermission('Leave Management', 'Leave Tracker', 'view'), asyncHandler(async (req, res) => {
  const options = await leaveService.getFilterOptions(req.context.organizationId);
  ApiResponse.success(res, { data: options });
}));

router.get('/balance/:userId', asyncHandler(async (req, res) => {
  const balance = await leaveService.getBalance(req.params.userId, req.organizationId);
  ApiResponse.success(res, { data: balance });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const leave = await leaveService.getById(req.params.id, req.user, req.organizationId);
  ApiResponse.success(res, { data: leave });
}));

router.patch('/:id/approve', checkPermission('Leave Management', 'Leave Requests', 'approve'), asyncHandler(async (req, res) => {
  const leave = await leaveService.approve(req.params.id, req.user._id, req.organizationId);
  ApiResponse.success(res, { message: 'Leave approved', data: leave });
}));

router.patch('/:id/reject', checkPermission('Leave Management', 'Leave Requests', 'reject'), asyncHandler(async (req, res) => {
  const leave = await leaveService.reject(req.params.id, req.user._id, req.body.reason, req.organizationId);
  ApiResponse.success(res, { message: 'Leave rejected', data: leave });
}));

// Sync timesheets for a single already-approved leave
router.patch('/:id/sync-timesheet', checkPermission('Leave Management', 'Leave Requests', 'approve'), asyncHandler(async (req, res) => {
  const result = await leaveService.syncTimesheet(req.params.id, req.user._id, req.organizationId);
  ApiResponse.success(res, { message: result.message });
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const leave = await leaveService.cancel(req.params.id, req.user._id, req.body.reason, req.user.role, req.organizationId);
  ApiResponse.success(res, { message: 'Leave cancelled', data: leave });
}));

module.exports = router;
