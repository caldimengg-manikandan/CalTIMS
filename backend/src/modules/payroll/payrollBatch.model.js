'use strict';

const mongoose = require('mongoose');

/**
 * PayrollBatch - stores one summary document per payroll run (month+year).
 * Created/updated by runPayroll(). Prevents duplicate rows in the history UI.
 */
const payrollBatchSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
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
      enum: ['Processing', 'Completed', 'Error'],
      default: 'Completed',
      index: true
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    paidBy: {
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
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
  },
  {
    timestamps: true,
  }
);

// Unique per month/year per organization — upsert will update in-place on re-runs
payrollBatchSchema.index({ organizationId: 1, month: 1, year: 1 }, { unique: true });

// --- Enterprise Schema-Level Immutability Locks ---
payrollBatchSchema.pre('save', function(next) {
    if (!this.isNew && this.isPaid && this.isModified() && !this.isModified('isPaid')) {
        return next(new Error('Schema Error: Cannot edit a PAID PayrollBatch. Record is immutable.'));
    }
    next();
});

payrollBatchSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], async function(next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.isPaid === true) return next();
    
    // Check if the batch is already paid before applying update
    const docs = await this.model.find(this.getQuery());
    for (const doc of docs) {
        if (doc.isPaid) {
            return next(new Error('Schema Error: Failed direct mutation. PAID PayrollBatches are immutable.'));
        }
    }
    next();
});

const PayrollBatch = mongoose.model('PayrollBatch', payrollBatchSchema);

module.exports = PayrollBatch;
