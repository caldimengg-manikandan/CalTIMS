'use strict';

const mongoose = require('mongoose');
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
  async login({ email, password, macAddress, req }) {
    const user = await User.findOne({ email }).select('+password').populate('roleId');
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact your administrator.', 403);
    }

    const subscription = await Subscription.findOne({ organizationId: user.organizationId });

    return { user, subscription };
  },

  /**
   * Social Login (Google/Microsoft) with account linking
   */
  async socialLogin({ email, name, provider, req }) {
    let user = await User.findOne({ email }).populate('roleId');

    if (user) {
      // Account linking: record provider if not already present in array
      if (!user.providers.includes(provider)) {
        user.providers.push(provider);
      }
    } else {
      // Create new user with provider initialization
      user = await User.create({
        email,
        name,
        provider,
        providers: [provider],
        isOnboardingComplete: false,
        isActive: true
      });
    }

    if (user && !user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact your administrator.', 403);
    }

    return user;
  },

  /**
   * Complete onboarding: Create Organization, Roles, Settings and link User
   */
  async completeOnboarding(userId, { organizationName, phoneNumber, req }) {
    const session = await mongoose.startSession();
    // Check if replica set is available for transactions
    const isReplicaSet = !!(await mongoose.connection.db.admin().command({ isMaster: 1 })).setName;

    if (isReplicaSet) session.startTransaction();

    try {
      const user = await User.findById(userId).session(isReplicaSet ? session : null);
      if (!user) throw new AppError('User not found', 404);
      if (user.isOnboardingComplete) throw new AppError('Onboarding already completed', 400);

      // 1. Create Organization
      const organization = (await Organization.create([{ name: organizationName }], { session }))[0];

      // 2. Create Default Roles
      const defaultRoles = [
        {
          name: 'Admin',
          permissions: { all: { all: ['all'] } },
          isSystemRole: true,
        },
        {
          name: 'Employee',
          permissions: { 
            timesheets: { 
              dashboard: ['view'],
              entry: ['view', 'create', 'edit'],
              history: ['view']
            } 
          },
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
        const r = (await Role.create([{ ...roleDef, organizationId: organization._id }], { session }))[0];
        if (roleDef.name === 'Admin') adminRole = r;
      }

      // 3. Create Default Settings
      await Settings.create([{
        organizationId: organization._id,
        organization: { companyName: organizationName },
        branding: { organizationName: organizationName }
      }], { session });

      // 4. Update User
      user.organizationId = organization._id;
      user.role = ROLES.ADMIN;
      user.roleId = adminRole._id;
      user.phoneNumber = phoneNumber;
      user.isOwner = true;
      user.isOnboardingComplete = true;
      await user.save({ session, validateBeforeSave: false });

      // 5. Create Trial Subscription
      await Subscription.create([{
        organizationId: organization._id,
        planType: 'TRIAL',
        status: 'ACTIVE'
      }], { session });

      if (isReplicaSet) await session.commitTransaction();

      // Log onboarding activity
      await logActivity({
        userId: user._id,
        organizationId: organization._id,
        action: 'ONBOARDING_COMPLETE',
        details: { organizationName },
        req
      });

      return await User.findById(user._id).populate('roleId');
    } catch (err) {
      if (isReplicaSet) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
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
        permissions: { 
          timesheets: { 
            dashboard: ['view'],
            entry: ['view', 'create', 'edit'],
            history: ['view']
          } 
        },
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
      provider: 'local',
      providers: ['local'],
      isActive: true,
      isOnboardingComplete: true,
      isOwner: true,
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

    // Log signup activity (using req for activity logger)
    await logActivity({
      userId: user._id,
      organizationId: organization._id,
      action: 'SIGNUP_TRIAL',
      details: {
        plan: 'TRIAL',
        organizationName
      },
      req: { ip: ipAddress, headers: { 'user-agent': deviceFingerprint } }
    });

    return { user, subscription };
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

    return { accessToken, refreshToken: newRefreshToken, user: user.toPublicJSON() };
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

  async generateTokensForUser(user, req) {
    const userId = user._id || user.id;
    // Always re-fetch or ensure population to get role/permissions
    user = await User.findById(userId).populate('roleId');
    if (!user) throw new AppError('User not found during token generation', 404);

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact your administrator.', 403);
    }

    user.lastLogin = new Date();
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    // Log login activity (Note: logActivity will only record if organizationId is present)
    await logActivity({
      userId: user._id,
      organizationId: user.organizationId,
      action: 'LOGIN',
      req
    });

    return { accessToken, refreshToken, user: user.toPublicJSON() };
  },
};

module.exports = { authService, generateTokens };
