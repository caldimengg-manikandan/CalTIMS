'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const leaveService = require('./leave.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

router.use(authenticate);

router.post('/', asyncHandler(async (req, res) => {
  const leave = await leaveService.apply(req.body, req.user._id);
  ApiResponse.created(res, { message: 'Leave application submitted', data: leave });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { leaves, pagination } = await leaveService.getAll(req.query, req.user);
  ApiResponse.success(res, { data: leaves, pagination });
}));

// ── GET all approved leaves for calendar display (visible to all users) ────────
router.get('/calendar', asyncHandler(async (req, res) => {
  const Leave = require('./leave.model');
  const filter = { status: 'approved' };

  // Filter: leave overlaps with the requested date range
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(req.query.from) : new Date('2000-01-01');
    const to   = req.query.to   ? new Date(req.query.to)   : new Date('9999-12-31');
    filter.startDate = { $lte: to };
    filter.endDate   = { $gte: from };
  }

  const leaves = await Leave.find(filter)
    .populate('userId', 'name employeeId')
    .sort({ startDate: 1 })
    .lean();

  // Map leaves to calendar-event shape
  const leaveTypeColors = {
    annual:    '#f59e0b',
    sick:      '#ef4444',
    casual:    '#8b5cf6',
    unpaid:    '#6b7280',
    maternity: '#ec4899',
    paternity: '#06b6d4',
  };

  const events = leaves.map(leave => ({
    _id:       leave._id,
    title:     `${leave.userId?.name || 'Employee'}`,
    startDate: leave.startDate,
    endDate:   leave.endDate,
    isAllDay:  true,
    isPublic:  true,
    isLeave:   true,
    color:     leaveTypeColors[leave.leaveType] || '#f59e0b',
    leaveType: leave.leaveType,
    employee:  leave.userId,
    totalDays: leave.totalDays,
    createdBy: leave.userId,     // so the calendar knows who owns it
  }));

  ApiResponse.success(res, { data: events });
}));

// ── Backfill route MUST be before /:id routes to avoid param conflict ──────────
router.post('/backfill-timesheets', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const result = await leaveService.backfillTimesheets(req.user._id);
  ApiResponse.success(res, {
    message: `Synced ${result.synced}/${result.total} approved leaves to timesheets`,
    data: result
  });
}));

router.get('/filter-options', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const options = await leaveService.getFilterOptions();
  ApiResponse.success(res, { data: options });
}));

router.get('/balance/:userId', asyncHandler(async (req, res) => {
  const balance = await leaveService.getBalance(req.params.userId);
  ApiResponse.success(res, { data: balance });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const leave = await leaveService.getById(req.params.id, req.user);
  ApiResponse.success(res, { data: leave });
}));

router.patch('/:id/approve', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const leave = await leaveService.approve(req.params.id, req.user._id);
  ApiResponse.success(res, { message: 'Leave approved', data: leave });
}));

router.patch('/:id/reject', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const leave = await leaveService.reject(req.params.id, req.user._id, req.body.reason);
  ApiResponse.success(res, { message: 'Leave rejected', data: leave });
}));

// Sync timesheets for a single already-approved leave
router.patch('/:id/sync-timesheet', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const result = await leaveService.syncTimesheet(req.params.id, req.user._id);
  ApiResponse.success(res, { message: result.message });
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const leave = await leaveService.cancel(req.params.id, req.user._id, req.body.reason, req.user.role);
  ApiResponse.success(res, { message: 'Leave cancelled', data: leave });
}));

module.exports = router;
