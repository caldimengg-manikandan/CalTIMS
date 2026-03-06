'use strict';

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // ── Report / Email Settings ────────────────────────────────────────────────
    report: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'fortnightly', 'monthly'],
        default: 'weekly',
      },
      reportType: {
        type: String,
        enum: ['mh_requests', 'approved', 'implemented', 'rejected'],
        default: 'approved',
      },
      scheduledTime: { type: String, default: '09:00' }, // HH:mm format
      recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],  // empty = all projects
      isActive: { type: Boolean, default: false },
      lastSentAt: { type: Date, default: null },
    },

    // ── Timesheet Customization ────────────────────────────────────────────────
    timesheet: {
      taskCategories: {
        type: [String],
        default: ['Development', 'Bug Fixing', 'Design', 'Meeting', 'Documentation', 'Testing'],
      },
      leaveTypes: {
        type: [String],
        default: ['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Paternity'],
      },
      eligibleLeaveTypes: {
        type: [String],
        default: ['annual', 'sick', 'casual'],
      },
      maxEntriesPerDay: { type: Number, default: 0 }, // 0 means no limit
      maxEntriesPerWeek: { type: Number, default: 0 }, // 0 means no limit
      permissionMaxHoursPerDay: { type: Number, default: 4 },
      permissionMaxDaysPerWeek: { type: Number, default: 0 }, // 0 means no limit
      permissionMaxDaysPerMonth: { type: Number, default: 0 }, // 0 means no limit
    },

    // ── General Settings ───────────────────────────────────────────────────────
    general: {
      companyName: { type: String, default: 'TimesheetPro' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      workingHoursPerDay: { type: Number, default: 8, min: 1, max: 24 },
      strictDailyHours: { type: Boolean, default: false },
      isWeekendWorkable: { type: Boolean, default: false },
      weekStartDay: { type: String, enum: ['monday', 'sunday'], default: 'monday' },
      dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        default: 'DD/MM/YYYY',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Singleton: only one settings document per app
const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;
