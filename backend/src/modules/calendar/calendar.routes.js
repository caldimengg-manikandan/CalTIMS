'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const CalendarEvent = require('./calendar.model');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

// Get events (supports month=YYYY-MM or range)
router.get('/', asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { month, from, to, eventType } = req.query;
  const organizationId = req.organizationId;

  // Base filter: events belonging to this organization AND (Global for org OR created by user)
  let filter = { organizationId };

  filter.$or = [
    { isGlobal: true },
    { createdBy: _id }
  ];

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, m - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    filter.startDate = { $lte: endOfMonth };
    filter.endDate = { $gte: startOfMonth };
  } else if (from || to) {
    if (from) filter.startDate = { $gte: new Date(from) };
    if (to) filter.endDate = { $lte: new Date(to) };
  }

  if (eventType) {
    filter.eventType = eventType;
  }

  const events = await CalendarEvent.find(filter)
    .populate('createdBy', 'name email')
    .sort({ startDate: 1 })
    .lean();

  ApiResponse.success(res, { data: events });
}));

router.post('/', asyncHandler(async (req, res) => {
  // Non-admins can only create personal events — enforce isGlobal: false server-side
  const payload = {
    ...req.body,
    createdBy: req.user._id,
    organizationId: req.organizationId,
    isGlobal: req.user.role === 'admin' ? (req.body.isGlobal ?? false) : false,
  };
  const event = await CalendarEvent.create(payload);
  ApiResponse.created(res, { message: 'Event created', data: event });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!event) return ApiResponse.notFound(res);

  // Only admin or the creator can update
  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, { message: 'You do not have permission to update this event' });
  }

  const updateData = { ...req.body };
  // Non-admins cannot change isGlobal status
  if (req.user.role !== 'admin') {
    delete updateData.isGlobal;
  }

  Object.assign(event, updateData);
  await event.save();

  ApiResponse.success(res, { message: 'Event updated', data: event });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!event) return ApiResponse.notFound(res);

  // Only admin or the creator can delete
  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, { message: 'You do not have permission to delete this event' });
  }

  await event.deleteOne();
  ApiResponse.success(res, { message: 'Event deleted' });
}));

module.exports = router;
