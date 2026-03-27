'use strict';

const mongoose = require('mongoose');

const salaryComponentSchema = new mongoose.Schema({
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
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

const salaryStructureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Role-Based', 'Employee-Based'],
      default: 'Role-Based',
    },
    earnings: [salaryComponentSchema],
    deductions: [salaryComponentSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const RoleSalaryStructure = mongoose.model('RoleSalaryStructure', salaryStructureSchema);

module.exports = RoleSalaryStructure;
