'use strict';

const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userActivityLogSchema.index({ userId: 1, createdAt: -1 });
userActivityLogSchema.index({ organizationId: 1, createdAt: -1 });

const UserActivityLog = mongoose.model('UserActivityLog', userActivityLogSchema);
module.exports = UserActivityLog;
