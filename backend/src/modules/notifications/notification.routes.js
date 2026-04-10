'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const notificationService = require('./notification.service');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

// Get all notifications for current user
router.get('/', asyncHandler(async (req, res) => {
  const result = await notificationService.getForUser(req.user.id, req.query, req.organizationId);
  ApiResponse.success(res, { data: result });
}));

// Get unread count
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id, req.organizationId);
  ApiResponse.success(res, { data: { count } });
}));

// Mark all as read (must come BEFORE /:id/read to avoid route conflict)
router.patch('/mark-all-read', asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id, req.organizationId);
  ApiResponse.success(res, { message: 'All notifications marked as read' });
}));

// Mark single as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.params.id, req.user.id, req.organizationId);
  ApiResponse.success(res, { data: notification });
}));

// Clear all notifications
router.delete('/clear-all', asyncHandler(async (req, res) => {
  await notificationService.clearAll(req.user.id, req.organizationId);
  ApiResponse.success(res, { message: 'All notifications cleared' });
}));

module.exports = router;
