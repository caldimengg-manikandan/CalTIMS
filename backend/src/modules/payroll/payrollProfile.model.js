'use strict';

const mongoose = require('mongoose');

const salaryComponentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: { type: String, required: true },
  value: { type: Number, default: 0 },
  calculationType: { 
    type: String, 
    enum: ['Fixed', 'Percentage', 'Formula'], 
    default: 'Fixed' 
  },
  formula: { type: String, default: null }, // e.g., 'Basic * 0.12'
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
});

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
    // Inline Salary Architecture
    earnings: [salaryComponentSchema],
    deductions: [salaryComponentSchema],

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
    profileVersion: {
      type: Number,
      default: 1,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
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

// Auto-increment version on salary changes
payrollProfileSchema.pre('save', function(next) {
  if (this.isModified('earnings') || this.isModified('deductions') || this.isModified('monthlyCTC')) {
    this.profileVersion += 1;
    this.lastUpdatedAt = Date.now();
  }
  next();
});

// One payroll profile per user per organization
payrollProfileSchema.index({ organizationId: 1, user: 1 }, { unique: true });

const PayrollProfile = mongoose.model('PayrollProfile', payrollProfileSchema);

module.exports = PayrollProfile;
