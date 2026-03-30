'use strict';

const mongoose = require('mongoose');
const { PROJECT_STATUS } = require('../../constants');

const allocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      trim: true,
      default: 'Developer',
    },
    allocationPercent: {
      type: Number,
      min: 1,
      max: 100,
      default: 100,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    budgetHours: {
      type: Number,
      default: 0,
    },
  },
  { _id: true, timestamps: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [200, 'Project name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Project code is required'],
      uppercase: true,
      trim: true,
      maxlength: [20, 'Project code cannot exceed 20 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000],
    },
    clientName: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return !this.startDate || this.startDate <= v;
        },
        message: 'End date cannot be before start date'
      }
    },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.ACTIVE,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project manager is required'],
    },
    allocatedEmployees: [allocationSchema],
    budget: {
      type: Number,
      default: 0,
    },
    budgetHours: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    onlyProjectTasks: {
      type: Boolean,
      default: false,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
projectSchema.index({ organizationId: 1, managerId: 1 });
projectSchema.index({ organizationId: 1, status: 1 });
projectSchema.index({ organizationId: 1, 'allocatedEmployees.userId': 1 });
projectSchema.index({ organizationId: 1, isActive: 1 });
projectSchema.index({ organizationId: 1, code: 1 }, { unique: true });

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
