'use strict';

const mongoose = require('mongoose');

const payrollProfileSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
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

const PayrollProfile = mongoose.model('PayrollProfile', payrollProfileSchema);

module.exports = PayrollProfile;
