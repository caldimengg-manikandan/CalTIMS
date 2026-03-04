'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const Announcement = require('./announcement.model');
const User = require('../users/user.model');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const notificationService = require('../notifications/notification.service');

router.use(authenticate);

// Get active announcements visible to the current user's role
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const now = new Date();
  const filter = {
    isActive: true,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ targetRoles: { $size: 0 } }, { targetRoles: req.user.role }] },
    ],
  };

  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('publishedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Announcement.countDocuments(filter),
  ]);

  ApiResponse.success(res, { data: announcements, pagination: buildPaginationMeta(total, page, limit) });
}));

// Admin-only: Get ALL announcements (including inactive/expired) for management view
router.get('/admin', authorize('admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [announcements, total] = await Promise.all([
    Announcement.find({})
      .populate('publishedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Announcement.countDocuments({}),
  ]);
  ApiResponse.success(res, { data: announcements, pagination: buildPaginationMeta(total, page, limit) });
}));

// Admin-only: Create announcement + notify all active users
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const ann = await Announcement.create({ ...req.body, publishedBy: req.user._id });

  // Determine who to notify based on targetRoles
  const targetRoles = req.body.targetRoles && req.body.targetRoles.length > 0
    ? req.body.targetRoles
    : ['admin', 'manager', 'employee'];

  const usersToNotify = await User.find(
    { isActive: true, role: { $in: targetRoles }, _id: { $ne: req.user._id } },
    '_id'
  ).lean();

  const typeEmoji = { urgent: '🚨', warning: '⚠️', info: 'ℹ️' };
  const emoji = typeEmoji[ann.type] || 'ℹ️';

  // Fire-and-forget bulk notifications
  const notifPromises = usersToNotify.map(u =>
    notificationService.create({
      userId: u._id,
      type: 'announcement',
      title: `${emoji} ${ann.title}`,
      message: ann.content.length > 120 ? ann.content.slice(0, 117) + '...' : ann.content,
      refId: ann._id,
      refModel: 'Announcement',
    })
  );
  await Promise.allSettled(notifPromises); // don't fail if one notification fails

  ApiResponse.created(res, { message: 'Announcement created', data: ann });
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const ann = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!ann) return ApiResponse.notFound(res);
  ApiResponse.success(res, { message: 'Announcement updated', data: ann });
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const ann = await Announcement.findByIdAndDelete(req.params.id);
  if (!ann) return ApiResponse.notFound(res);
  ApiResponse.success(res, { message: 'Announcement deleted' });
}));

module.exports = router;
