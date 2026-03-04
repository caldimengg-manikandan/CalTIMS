'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const CalendarEvent = require('./calendar.model');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

router.use(authenticate);

// Get events in a date range
router.get('/', asyncHandler(async (req, res) => {
  const { _id } = req.user;
  let baseFilter = {};

  // Everyone (Admin, Manager, Employee) sees their own personal events OR any public (global) events
  baseFilter = { $or: [{ createdBy: _id }, { isPublic: true }] };

  let dateFilter = {};
  if (req.query.from || req.query.to) {
    dateFilter.startDate = {};
    if (req.query.from) dateFilter.startDate.$gte = new Date(req.query.from);
    if (req.query.to) dateFilter.startDate.$lte = new Date(req.query.to);
  }
  if (req.query.eventType) dateFilter.eventType = req.query.eventType;

  const filter = { ...baseFilter, ...dateFilter };

  const events = await CalendarEvent.find(filter)
    .populate('createdBy', 'name email')
    .sort({ startDate: 1 })
    .lean();

  ApiResponse.success(res, { data: events });
}));

router.post('/', asyncHandler(async (req, res) => {
  // Non-admins can only create personal events — enforce isPublic: false server-side
  const payload = {
    ...req.body,
    createdBy: req.user._id,
    isPublic: req.user.role === 'admin' ? (req.body.isPublic ?? false) : false,
  };
  const event = await CalendarEvent.create(payload);
  ApiResponse.created(res, { message: 'Event created', data: event });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findById(req.params.id);
  if (!event) return ApiResponse.notFound(res);

  // Only admin or the creator can update
  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, { message: 'You do not have permission to update this event' });
  }

  const updateData = { ...req.body };
  // Non-admins cannot change isPublic status
  if (req.user.role !== 'admin') {
    delete updateData.isPublic;
  }

  Object.assign(event, updateData);
  await event.save();
  
  ApiResponse.success(res, { message: 'Event updated', data: event });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findById(req.params.id);
  if (!event) return ApiResponse.notFound(res);

  // Only admin or the creator can delete
  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, { message: 'You do not have permission to delete this event' });
  }

  await event.deleteOne();
  ApiResponse.success(res, { message: 'Event deleted' });
}));

module.exports = router;
