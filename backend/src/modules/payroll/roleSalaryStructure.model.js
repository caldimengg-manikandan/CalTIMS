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

const salaryStructureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    /** Append-Only Effective Dating */
    effectiveFrom: {
      type: Date,
      default: Date.now,
      index: true
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    /** Soft Delete Strategy */
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

// Updated Index to support versioning. name is only unique for the same period.
salaryStructureSchema.index({ organizationId: 1, name: 1, effectiveFrom: 1 }, { unique: true });

const RoleSalaryStructure = mongoose.model('RoleSalaryStructure', salaryStructureSchema);

module.exports = RoleSalaryStructure;
