'use strict';

const mongoose = require('mongoose');
const { ANNOUNCEMENT_TYPES, ROLES } = require('../../constants');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: Object.values(ANNOUNCEMENT_TYPES),
      default: ANNOUNCEMENT_TYPES.INFO,
    },
    targetRoles: {
      type: [String],
      enum: [...Object.values(ROLES), 'all'],
      default: [], // Empty means visible to all roles
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
announcementSchema.index({ targetRoles: 1 });

const Announcement = mongoose.model('Announcement', announcementSchema);
module.exports = Announcement;
