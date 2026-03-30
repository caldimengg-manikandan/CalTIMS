'use strict';

const mongoose = require('mongoose');

// ── History entry (embedded) ─────────────────────────────────────────────────
const historyEntrySchema = new mongoose.Schema({
  sentAt:         { type: Date, default: Date.now },
  status:         { type: String, enum: ['success', 'failed'], default: 'success' },
  recipientCount: { type: Number, default: 0 },
  reportTitle:    { type: String, default: '' },
  error:          { type: String, default: null },
}, { _id: true });

// ── Report Schedule ──────────────────────────────────────────────────────────
const reportScheduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Schedule name is required'],
      trim: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'fortnightly', 'monthly'],
      default: 'weekly',
    },
    scheduledTime: {
      type: String,   // HH:mm  e.g. "09:00"
      default: '09:00',
    },
    reportType: {
      type: String,
      enum: ['approved', 'rejected', 'pending', 'all'],
      default: 'approved',
    },
    recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    projectIds:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    isActive:     { type: Boolean, default: true },
    lastSentAt:   { type: Date, default: null },
    // ring-buffer: last 50 history entries
    history:      { type: [historyEntrySchema], default: [] },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Keep history limited to most recent 50 entries
reportScheduleSchema.methods.addHistory = async function (entry) {
  this.history.unshift(entry);
  if (this.history.length > 50) this.history = this.history.slice(0, 50);
  this.lastSentAt = entry.sentAt || new Date();
  return this.save();
};

module.exports = mongoose.model('ReportSchedule', reportScheduleSchema);
