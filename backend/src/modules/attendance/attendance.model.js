'use strict';

const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['check-in', 'check-out'],
      required: true,
    },
    deviceId: {
      type: String,
      default: 'HIKVISION-01',
    },
    rawLog: {
      type: Object,
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

// Prevent duplicates per organization
attendanceLogSchema.index({ organizationId: 1, userId: 1, timestamp: 1, type: 1 }, { unique: true });

const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);
module.exports = AttendanceLog;
