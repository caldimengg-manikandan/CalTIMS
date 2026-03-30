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
    status: {
      type: String,
      enum: ['Draft', 'Processing', 'Processed', 'Warning', 'Failed', 'Pending Approval', 'Approved', 'Paid', 'Locked', 'Completed'],
      default: 'Draft',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Initiated', 'Success', 'Failed'],
      default: 'Pending',
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
    processedAt: Date,
    paidAt: Date,
    bankReference: String,
    isLocked: { type: Boolean, default: false },
    lockedAt: Date,
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isEmailSent: { type: Boolean, default: false },
    lastEmailSentAt: Date,

  },
  {
    timestamps: true,
  }
);

// Ensure only one processed entry per user/month/year per organization
processedPayrollSchema.index({ organizationId: 1, user: 1, month: 1, year: 1 }, { unique: true });

const ProcessedPayroll = mongoose.model('ProcessedPayroll', processedPayrollSchema);

module.exports = ProcessedPayroll;
