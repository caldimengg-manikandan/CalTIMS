'use strict';

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['hikvision', 'zkteco', 'hikcentral'],
      required: true,
      default: 'hikvision'
    },
    config: {
      ipAddress: { type: String, default: '' },
      host: { type: String, default: '' },
      port: { type: Number, default: 80 },
      username: { type: String, default: '' },
      password: { type: String, default: '' },
      appKey: { type: String, default: '' },
      appSecret: { type: String, default: '' },
    },
    lastSyncAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'error'],
      default: 'offline'
    },
    lastError: {
      type: String,
      default: ''
    },
    enabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
