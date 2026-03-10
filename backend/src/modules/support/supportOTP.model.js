'use strict';

const mongoose = require('mongoose');

const supportOTPSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            trim: true,
            lowercase: true,
            unique: true,
        },
        otp: {
            type: String,
            required: [true, 'OTP is required'],
        },
        expiresAt: {
            type: Date,
            required: [true, 'Expiration time is required'],
            index: { expires: 0 }, // TTL index to auto-delete expired OTPs
        },
        verified: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

const SupportOTP = mongoose.model('SupportOTP', supportOTPSchema);

module.exports = SupportOTP;
