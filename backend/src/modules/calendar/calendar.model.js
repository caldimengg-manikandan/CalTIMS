'use strict';

const mongoose = require('mongoose');
const { CALENDAR_EVENT_TYPES, ROLES } = require('../../constants');

const calendarEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000],
    },
    eventType: {
      type: String,
      enum: Object.values(CALENDAR_EVENT_TYPES),
      default: CALENDAR_EVENT_TYPES.COMPANY_EVENT,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    isAllDay: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      default: '#3B82F6',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetRoles: {
      type: [String],
      enum: [...Object.values(ROLES), 'all'],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

calendarEventSchema.index({ startDate: 1, endDate: 1 });
calendarEventSchema.index({ eventType: 1 });
calendarEventSchema.index({ isPublic: 1 });

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);
module.exports = CalendarEvent;
