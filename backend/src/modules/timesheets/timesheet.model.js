'use strict';

const mongoose = require('mongoose');
const { TIMESHEET_STATUS } = require('../../constants');

const timesheetEntrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Entry date is required'],
    },
    hoursWorked: {
      type: Number,
      required: [true, 'Hours worked is required'],
      min: [0, 'Hours cannot be negative'],
      max: [24, 'Hours cannot exceed 24 per day'],
    },
    taskDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Task description cannot exceed 500 characters'],
    },
    isLeave: {
      type: Boolean,
      default: false,
    },
    isHoliday: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const timesheetRowSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required'],
  },
  category: {
    type: String,
    trim: true,
    default: 'Development',
  },
  entries: [timesheetEntrySchema],
  totalHours: {
    type: Number,
    default: 0
  }
});

const timesheetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    weekStartDate: {
      type: Date,
      required: [true, 'Week start date is required'],
    },
    weekEndDate: {
      type: Date,
      required: [true, 'Week end date is required'],
    },
    status: {
      type: String,
      enum: Object.values(TIMESHEET_STATUS),
      default: TIMESHEET_STATUS.DRAFT,
    },
    rows: [timesheetRowSchema],
    totalHours: {
      type: Number,
      default: 0,
    },
    submittedAt: {
      type: Date,
      default: null,
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
    comments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comments cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Enforce ONE document per user per week
timesheetSchema.index({ userId: 1, weekStartDate: 1 }, { unique: true });
timesheetSchema.index({ status: 1, weekStartDate: -1 });
timesheetSchema.index({ weekStartDate: -1 });

// ─── Pre-save: Calculate totals ──────────────────────────────────────────────
timesheetSchema.pre('save', function (next) {
  let grandTotal = 0;
  const totalsByDay = {}; // Key: YYYY-MM-DD tracking sum per day
  
  this.rows.forEach(row => {
    let rowTotal = 0;
    row.entries.forEach(e => {
      const hours = e.hoursWorked || 0;
      
      // Group by date string to validate daily total
      try {
        const d = new Date(e.date);
        const dateStr = d.toISOString().split('T')[0];
        totalsByDay[dateStr] = (totalsByDay[dateStr] || 0) + hours;
      } catch (err) {
        // Skip invalid dates; model validation will catch them
      }
      
      rowTotal += hours;
    });
    row.totalHours = rowTotal;
    grandTotal += rowTotal;
  });
  
  // Final validation: Total hours per day cannot exceed 24
  for (const date in totalsByDay) {
    if (totalsByDay[date] > 24.001) { // Floating point buffer
      return next(new Error(`Total hours entered for ${date} (${totalsByDay[date].toFixed(2)}) exceed the 24-hour daily limit.`));
    }
  }
  
  this.totalHours = grandTotal;
  next();
});

const Timesheet = mongoose.model('Timesheet', timesheetSchema);
module.exports = Timesheet;
