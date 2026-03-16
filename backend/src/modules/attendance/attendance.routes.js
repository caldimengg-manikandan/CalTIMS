'use strict';

const express = require('express');
const router = express.Router();
const attendanceService = require('./attendance.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');
const ApiResponse = require('../../shared/utils/apiResponse');
const asyncHandler = require('../../shared/utils/asyncHandler');

// ─── Public/Internal Sync Endpoint (Used by Gateway Daemon) ──────────────────
// In a real production app, this would be secured with an API Key or HMAC.
router.post('/sync', asyncHandler(async (req, res) => {
  const { logs } = req.body;
  if (!Array.isArray(logs)) {
    return res.status(400).json({ success: false, message: 'Invalid payload: logs must be an array' });
  }

  const result = await attendanceService.syncLogs(logs);
  ApiResponse.success(res, { message: 'Sync completed', data: result });
}));

// ─── Authenticated Routes ─────────────────────────────────────────────────────
router.use(authenticate);

// ─── Hikvision Integration Routes ───────────────────────────────────────────
const hikvisionController = require('./hikvision.controller');
const hikcentralRoutes = require('./hikcentral.routes');

router.use('/hikcentral', hikcentralRoutes);

router.post('/hikvision/test', checkPermission('manageSettings'), hikvisionController.testConnection);
router.post('/hikvision/sync', checkPermission('manageSettings'), hikvisionController.manualSync);

router.get('/devices', checkPermission('manageSettings'), hikvisionController.getDevices);
router.post('/devices', checkPermission('manageSettings'), hikvisionController.createDevice);
router.put('/devices/:id', checkPermission('manageSettings'), hikvisionController.updateDevice);
router.delete('/devices/:id', checkPermission('manageSettings'), hikvisionController.deleteDevice);

// GET /api/v1/attendance - Get my attendance
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const userId = req.user._id;
  const logs = await attendanceService.getAttendance(userId, from || new Date(Date.now() - 7*24*60*60*1000), to || new Date());
  ApiResponse.success(res, { data: logs });
}));

// GET /api/v1/attendance/user/:userId - Admin/Manager view user attendance
router.get('/user/:userId', checkPermission('viewReports'), asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const { userId } = req.params;
  const logs = await attendanceService.getAttendance(userId, from || new Date(Date.now() - 7*24*60*60*1000), to || new Date());
  ApiResponse.success(res, { data: logs });
}));

module.exports = router;
