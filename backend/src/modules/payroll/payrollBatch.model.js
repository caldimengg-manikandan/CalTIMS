'use strict';

const mongoose = require('mongoose');

/**
 * PayrollBatch - stores one summary document per payroll run (month+year).
 * Created/updated by runPayroll(). Prevents duplicate rows in the history UI.
 */
const payrollBatchSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      index: true
    },
    month: {
      type: Number, // 1–12
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    /** Number of employees successfully processed */
    totalEmployees: {
      type: Number,
      required: true,
      default: 0,
    },
    totalGross: {
      type: Number,
      required: true,
      default: 0,
    },
    totalNet: {
      type: Number,
      required: true,
      default: 0,
    },
    totalDeductions: {
      type: Number,
      required: true,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Draft', 'Processing', 'Processed', 'Warning', 'Failed', 'Pending Approval', 'Approved', 'Paid', 'Locked', 'Completed'],
      default: 'Draft',
      index: true
    },
    approvals: {
      hrApproved: { type: Boolean, default: false },
      financeApproved: { type: Boolean, default: false },
      adminApproved: { type: Boolean, default: false },
      
      approvedBy: {
        hr: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        finance: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      },
      
      timestamps: {
        hr: Date,
        finance: Date,
        admin: Date
      }
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedAt: {
      type: Date,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    executionSummary: {
      type: String,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    /** Raw errors array for audit */
    errors: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        error: String,
      },
    ],
    version: {
      type: String,
      default: '1.2.0-enterprise',
    },
    audit: {
      bankReconciliation: {
        type: String,
        enum: ['Verified', 'Pending', 'Required'],
        default: 'Required',
      },
      taxCompliance: {
        type: String,
        enum: ['Verified', 'Pending', 'Required'],
        default: 'Pending',
      },
      varianceAnalysis: {
        type: String,
        enum: ['Verified', 'Pending', 'Required'],
        default: 'Pending',
      },
      discrepancies: {
        type: Number,
        default: 0,
      },
    },
    departmentDistribution: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Unique per month/year — upsert will update in-place on re-runs
payrollBatchSchema.index({ month: 1, year: 1 }, { unique: true });

const PayrollBatch = mongoose.model('PayrollBatch', payrollBatchSchema);

module.exports = PayrollBatch;
