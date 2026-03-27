'use strict';

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    planType: {
      type: String,
      enum: ['TRIAL', 'BASIC', 'PRO'],
      default: 'TRIAL',
    },
    trialStartDate: {
      type: Date,
      default: Date.now,
    },
    trialEndDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    notified7Days: {
      type: Boolean,
      default: false,
    },
    notified1Day: {
      type: Boolean,
      default: false,
    },
    notifiedExpired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate trialEndDate for new TRIAL subscriptions
subscriptionSchema.pre('save', function (next) {
  if (this.isNew && this.planType === 'TRIAL' && !this.trialEndDate) {
    this.trialEndDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days
  }
  next();
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
