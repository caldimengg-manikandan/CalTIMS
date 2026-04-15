'use strict';

const crypto = require('crypto');
const emailService = require('./email.service');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Simple in-memory cache for OTPs
const otpCache = new Map();

const otpService = {
  /**
   * Generate and send a 6-digit OTP
   */
  async sendOTP(email, type = 'Verification') {
    if (!email) throw new AppError('Email is required', 400);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in cache
    otpCache.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000
      
    });

    try {
      await emailService.sendNotificationEmail(email, {
        title: `${type} Code`,
        message: `Your verification code for CALTIMS is: <b>${otp}</b>. This code will expire in 10 minutes.`,
        companyName: 'CALTIMS'
      });
      logger.info(`OTP sent to ${email}`);
      return true;
    } catch (error) {
      logger.error('Failed to send OTP email:', error);
      throw new AppError('Failed to send verification code', 500);
    }
  },

  /**
   * Verify an OTP
   */
  async verifyOTP(email, otp) {
    if (!email || !otp) throw new AppError('Email and OTP are required', 400);
    
    const cached = otpCache.get(email.toLowerCase());
    if (!cached) {
      throw new AppError('Verification code not found', 400);
    }

    if (Date.now() > cached.expiresAt) {
      otpCache.delete(email.toLowerCase());
      throw new AppError('Verification code has expired', 400);
    }

    if (cached.otp !== otp) {
      throw new AppError('Invalid verification code', 400);
    }

    // Note: We don't delete the OTP here because it needs to be verified 
    // again during the final registration submission. It will expire naturally.
    return true;
  },

  /**
   * Manually remove an OTP from cache
   */
  async deleteOTP(email) {
    if (email) otpCache.delete(email.toLowerCase());
  }
};

module.exports = otpService;
