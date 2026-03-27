'use strict';

const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    permissions: {
      type: Object, // Hierarchical: { Module: { Submodule: [Actions] } }
      default: {},
    },
    description: {
      type: String,
      trim: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
