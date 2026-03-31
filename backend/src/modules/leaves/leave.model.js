'use strict';

const mongoose = require('mongoose');
const { LEAVE_STATUS, LEAVE_TYPES } = require('../../constants');

const leaveSchema = new mongoose.Schema(
  {
    leaveId: {
      type: String,
      trim: true,
      // unique: true // Removed global unique constraint
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    leaveType: {
      type: String,
      required: [true, 'Leave type is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    totalDays: {
      type: Number,
      required: [true, 'Total days is required'],
      min: [0.5, 'Minimum leave duration is 0.5 days'],
    },
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
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
    toJSON: { virtuals: true },
  }
);

// Auto-generate leaveId before save if not set (scoped to organization)
leaveSchema.pre('save', async function (next) {
  if (this.leaveId || !this.isNew || !this.organizationId) return next();
  try {
     const count = await this.constructor.countDocuments({ organizationId: this.organizationId });
     this.leaveId = `LEV${String(count + 1).padStart(4, '0')}`;
     next();
  } catch (err) {
     next(err);
  }
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
leaveSchema.index({ organizationId: 1, leaveId: 1 }, { unique: true });
leaveSchema.index({ organizationId: 1, userId: 1, status: 1 });
leaveSchema.index({ organizationId: 1, userId: 1, startDate: -1 });
leaveSchema.index({ organizationId: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ organizationId: 1, status: 1 });
leaveSchema.index({ organizationId: 1, approvedBy: 1 });

const Leave = mongoose.model('Leave', leaveSchema);
module.exports = Leave;
