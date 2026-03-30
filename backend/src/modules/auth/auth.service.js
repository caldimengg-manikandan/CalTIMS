'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../users/user.model');
const Organization = require('../organizations/organization.model');
const Subscription = require('../subscriptions/subscription.model');
const TrialTracking = require('../subscriptions/trialTracking.model');
const AppError = require('../../shared/utils/AppError');
const { logActivity } = require('../../shared/utils/activityLogger');
const Role = require('../users/role.model');
const Settings = require('../settings/settings.model');
const { ROLES } = require('../../constants');

/**
 * Generate JWT tokens
 */
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ sub: userId, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

/**
 * Hash a string (for refresh token storage)
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');


const authService = {
  /**
   * Login user and return tokens
   */
  async login({ email, password, macAddress, req }) {
    const user = await User.findOne({ email, isActive: true })
      .select('+password')
      .populate('roleId');
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update lastLogin on login
    user.lastLogin = new Date();
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    const subscription = await Subscription.findOne({ organizationId: user.organizationId });

    // Log login activity
    await logActivity({
      userId: user._id,
      organizationId: user.organizationId,
      action: 'LOGIN',
      req: req // Need to pass req from controller to service
    });

    return { accessToken, refreshToken, user: user.toPublicJSON(), subscription };
  },

  /**
   * Signup an organization and create first admin user with 28-day trial
   */
  async register({ email, password, name, organizationName, phoneNumber, ipAddress, deviceFingerprint }) {
    // 1. Trial Abuse Prevention
    const existingTrial = await TrialTracking.findOne({
      $or: [{ email }, { phoneNumber }]
    });

    if (existingTrial) {
      throw new AppError('You have already used your free trial.', 400);
    }

    // Check if email already used in User model
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already registered.', 409);
    }

    // 2. Create Organization
    const organization = await Organization.create({
      name: organizationName
    });

    // 2.1 Create Default Settings for Organization
    await Settings.create({
      organizationId: organization._id,
      organization: {
        companyName: organizationName
      },
      branding: {
        organizationName: organizationName
      }
    });

    // 2.2 Create Default Roles for Organization
    const defaultRoles = [
      {
        name: 'Admin',
        permissions: { all: { all: ['all'] } },
        isSystemRole: true,
      },
      {
        name: 'Employee',
        permissions: { timesheets: { all: ['view', 'create', 'edit'] } },
        isSystemRole: false,
      },
      {
        name: 'Finance',
        permissions: { payroll: { all: ['view', 'approve'] } },
        isSystemRole: false,
      }
    ];

    let adminRole;
    for (const roleDef of defaultRoles) {
      try {
        const r = await Role.create({
          ...roleDef,
          organizationId: organization._id
        });
        if (roleDef.name === 'Admin') adminRole = r;
      } catch (err) {
        if (err.code !== 11000) throw err;
        if (roleDef.name === 'Admin') {
           adminRole = await Role.findOne({ name: 'Admin', organizationId: organization._id });
        }
      }
    }

    if (!adminRole) {
      throw new AppError('Admin role could not be created or found during signup.', 500);
    }

    // 3. Create Admin User
    const user = await User.create({
      email,
      password,
      name,
      phoneNumber,
      organizationId: organization._id,
      role: ROLES.ADMIN,
      roleId: adminRole._id,
      isActive: true,
      lastLogin: new Date()
    });

    // 4. Create 28-Day Trial Subscription
    const subscription = await Subscription.create({
      organizationId: organization._id,
      planType: 'TRIAL',
      status: 'ACTIVE'
    });

    // 5. Save Trial Tracking info
    await TrialTracking.create({
      email,
      phoneNumber,
      ipAddress,
      deviceFingerprint
    });

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    const publicUser = user.toPublicJSON();
    if (user.roleId && user.roleId.permissions) {
      publicUser.permissions = user.roleId.permissions;
      publicUser.roleName = user.roleId.name;
    }

    // Log signup activity
    await logActivity({
      userId: user._id,
      organizationId: organization._id,
      action: 'SIGNUP_TRIAL',
      details: {
        plan: 'TRIAL',
        organizationName
      },
      req: { ip: ipAddress, headers: { 'user-agent': deviceFingerprint } } // Simplified req for signup
    });

    return { accessToken, refreshToken, user: publicUser, subscription };
  },

  /**
   * Refresh access token using refresh token from cookie
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new AppError('Refresh token not provided', 401);

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await User.findById(decoded.sub)
      .select('+refreshTokenHash')
      .populate('roleId');
    if (!user || !user.isActive) {
      throw new AppError('User not found or deactivated', 401);
    }

    const tokenHash = hashToken(refreshToken);
    if (user.refreshTokenHash !== tokenHash) {
      // Token reuse detected — revoke all sessions
      user.refreshTokenHash = null;
      await user.save({ validateBeforeSave: false });
      throw new AppError('Token reuse detected. Please log in again.', 401);
    }

    // Rotate refresh token
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role);
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    const publicUser = user.toPublicJSON();
    if (user.roleId && user.roleId.permissions) {
      publicUser.permissions = user.roleId.permissions;
      publicUser.roleName = user.roleId.name;
    }

    return { accessToken, refreshToken: newRefreshToken, user: publicUser };
  },

  /**
   * Logout — revoke refresh token
   */
  async logout(userId) {
    await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
  },

  /**
   * Change password
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new AppError('User not found', 404);

    if (!(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    return true;
  },

  /**
   * Generate and store password reset token
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email, isActive: true });
    if (!user) throw new AppError('No user with this email address', 404);

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    return { resetToken, user };
  },

  /**
   * Reset password using token
   */
  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError('Token is invalid or has expired', 400);

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokenHash = null;
    await user.save({ validateBeforeSave: false });
    return true;
  },
};

module.exports = { authService, generateTokens };
