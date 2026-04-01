'use strict';

const mongoose = require('mongoose');

const payrollJobSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['GENERATE_PAYSLIPS', 'SEND_PAYSLIP_EMAILS', 'RECONCILE_BANK'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed', 'Failed'],
      default: 'Pending',
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastError: {
      type: String,
    },
    priority: {
      type: Number,
      default: 0,
    },
    processedAt: Date,
  },
  {
    timestamps: true,
  }
);

const PayrollJob = mongoose.model('PayrollJob', payrollJobSchema);

module.exports = PayrollJob;
