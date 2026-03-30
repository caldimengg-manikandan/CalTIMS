'use strict';

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Task name is required'],
      trim: true,
      maxlength: [200, 'Task name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'on-hold'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Indexes
taskSchema.index({ organizationId: 1, name: 1 });
taskSchema.index({ organizationId: 1, projectId: 1 });
taskSchema.index({ organizationId: 1, status: 1 });
taskSchema.index({ organizationId: 1, isActive: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
