'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'leave_applied', 'leave_approved', 'leave_rejected', 'leave_cancelled',
        'timesheet_submitted', 'timesheet_approved', 'timesheet_rejected',
        'incident_created', 'incident_updated', 'incident_resolved', 'incident_response'
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    refModel: {
      type: String,
      enum: ['Leave', 'Timesheet', 'Incident', null],
      default: null,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ organizationId: 1, userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
