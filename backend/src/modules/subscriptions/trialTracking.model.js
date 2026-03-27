'use strict';

const mongoose = require('mongoose');

const trialTrackingSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ipAddress: {
      type: String,
    },
    deviceFingerprint: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const TrialTracking = mongoose.model('TrialTracking', trialTrackingSchema);
module.exports = TrialTracking;
