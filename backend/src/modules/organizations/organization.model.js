'use strict';

const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      unique: true,
    },
    taxId: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    settings: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settings',
    },
  },
  {
    timestamps: true,
  }
);

const Organization = mongoose.model('Organization', organizationSchema);
module.exports = Organization;
