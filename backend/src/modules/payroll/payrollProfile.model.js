'use strict';

const mongoose = require('mongoose');

const payrollProfileSchema = new mongoose.Schema(
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
    payrollType: {
      type: String,
      enum: ['Monthly', 'Weekly', 'Hourly', 'Daily'],
      required: true,
      default: 'Monthly',
    },
    employeeType: {
      type: String,
      enum: ['Permanent', 'Intern', 'Contract'],
      default: 'Permanent',
    },
    salaryMode: {
      type: String,
      enum: ['Role-Based', 'Employee-Based'],
      default: 'Employee-Based',
    },
    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoleSalaryStructure',
      default: null,
    },
    weeklyRate: {
      type: Number,
      default: 0,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    dailyRate: {
      type: Number,
      default: 0,
    },
    monthlyCTC: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// One payroll profile per user per organization
payrollProfileSchema.index({ organizationId: 1, user: 1 }, { unique: true });

const PayrollProfile = mongoose.model('PayrollProfile', payrollProfileSchema);

module.exports = PayrollProfile;
