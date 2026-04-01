'use strict';

const mongoose = require('mongoose');

const processedPayrollSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: Number, // 1-12
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    paymentType: {
      type: String,
      enum: ['Monthly', 'Yearly', 'Weekly', 'Hourly', 'Daily'],
      required: true,
    },
    currencySymbol: { type: String, default: '₹' },
    payslipTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayslipTemplate',
      required: false
    },
    attendance: {
      presents: Number,
      absents: Number,
      leaves: Number,
      lopDays: Number,
      approvedHours: Number, // for hourly logic
      payableWeeks: Number, // for weekly logic
      workedDays: Number, // for daily logic
      overtimeHours: Number,
      payableDays: Number,
    },
    breakdown: {
      earnings: {
        components: [
          { name: String, value: Number }
        ],
        grossEarnings: Number,
      },
      deductions: {
        components: [
          { name: String, value: Number }
        ],
        totalDeductions: Number,
      },
      netPay: Number,
      lopDeduction: Number,
      executionLog: [{
        component: String,
        type: { type: String, enum: ['Earning', 'Deduction'] },
        formula: String,
        result: Number,
        error: String,
        errorType: String
      }],
    },
    grossYield: Number,
    liability: Number,
    netPay: Number,
    isPaid: {
      type: Boolean,
      default: false,
      index: true
    },
    paidAt: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Check', 'Other'],
      default: 'Bank Transfer',
    },
    transactionId: String,
    failureReason: String,
    // Snapshot fields for historical accuracy
    employeeInfo: {
        name: String,
        employeeId: String,
        department: String,
        designation: String,
        branch: String,
    },
    bankDetails: {
        bankName: String,
        accountNumber: String,
        ifscCode: String,
        uan: String,
        pan: String,
        aadhaar: String,
    },
    profileVersion: Number,
    processedAt: Date,
    bankReference: String,
    isEmailSent: { type: Boolean, default: false },
    lastEmailSentAt: Date,

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

// Ensure only one processed entry per user/month/year per organization
processedPayrollSchema.index({ organizationId: 1, user: 1, month: 1, year: 1 }, { unique: true });

// --- Enterprise Schema-Level Immutability Locks ---
processedPayrollSchema.pre('save', function(next) {
    if (!this.isNew && this.isPaid) {
        const modified = this.modifiedPaths() || [];
        const allowed = ['isEmailSent', 'lastEmailSentAt'];
        if (modified.some(p => !allowed.includes(p))) {
            return next(new Error('Schema Error: Cannot edit a PAID ProcessedPayroll. Record is immutable.'));
        }
    }
    next();
});

processedPayrollSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], async function(next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.isPaid === true) return next();
    
    // Check if the record is already paid before applying update
    const docs = await this.model.find(this.getQuery());
    for (const doc of docs) {
        if (doc.isPaid) {
            if (update.$set) {
                const keys = Object.keys(update.$set);
                const allowed = ['isEmailSent', 'lastEmailSentAt'];
                if (keys.some(k => !allowed.includes(k))) {
                     return next(new Error('Schema Error: Failed direct mutation. PAID ProcessedBatches are immutable.'));
                }
            } else {
                 return next(new Error('Schema Error: Failed direct mutation. PAID ProcessedBatches are immutable.'));
            }
        }
    }
    next();
});

const ProcessedPayroll = mongoose.model('ProcessedPayroll', processedPayrollSchema);

module.exports = ProcessedPayroll;
