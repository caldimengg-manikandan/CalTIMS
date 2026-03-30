'use strict';

const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
    },
    permissions: {
      type: Object,
      default: {},
    },
    description: {
      type: String,
      trim: true,
    },
    isSystemRole: {
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
  }
);

/**
 * Compound unique index to ensure role names are unique within an organization
 * but can be duplicated across different organizations.
 */
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
