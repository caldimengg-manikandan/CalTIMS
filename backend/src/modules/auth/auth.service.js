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
const logger = require('../../shared/utils/logger');
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

    try {
      let result;
      
            let isReplicaSet = false;
      try {
        const adminDb = mongoose.connection.db.admin();
        const status = await adminDb.command({ isMaster: 1 });
        isReplicaSet = !!status.setName;
      } catch (e) {
        logger.warn('Could not determine replica set status, defaulting to non-replica set mode');
        isReplicaSet = false;
      }

      
      const executeOnboarding = async () => {
        // 0. Pre-checks inside transaction for consistency
        const user = await User.findById(userId).session(isReplicaSet ? session : null);
        if (!user) throw new AppError('User not found', 404);
        if (user.isOnboardingComplete) throw new AppError('Onboarding already completed', 400);

        // Check for duplicate organization name
        const existingOrg = await Organization.findOne({ name: organizationName }).session(isReplicaSet ? session : null);
        if (existingOrg) {
          throw new AppError('An organization with this name already exists. Please choose another name.', 409);
        }

        // 1. Create Organization
        const organization = (await Organization.create([{ name: organizationName }], { session: isReplicaSet ? session : null }))[0];

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
          // Check if role already exists for this organization (shouldn't happen for new org)
          const existingRole = await Role.findOne({ 
            name: roleDef.name, 
            organizationId: organization._id 
          }).session(isReplicaSet ? session : null);

          if (existingRole) {
            if (roleDef.name === 'Admin') adminRole = existingRole;
            continue;
          }

          const r = (await Role.create([{ ...roleDef, organizationId: organization._id }], { session: isReplicaSet ? session : null }))[0];
          if (roleDef.name === 'Admin') adminRole = r;
        }

        // 3. Create Default Settings
        await Settings.create([{
          organizationId: organization._id,
          organization: { companyName: organizationName },
          branding: { organizationName: organizationName }
        }], { session: isReplicaSet ? session : null });

        // 4. Update User
        user.organizationId = organization._id;
        user.role = ROLES.ADMIN;
        user.roleId = adminRole._id;
        user.phoneNumber = phoneNumber;
        user.isOwner = true;
        user.isOnboardingComplete = true;
        await user.save({ session: isReplicaSet ? session : null, validateBeforeSave: false });

        // 5. Create Trial Subscription
        await Subscription.create([{
          organizationId: organization._id,
          planType: 'TRIAL',
          status: 'ACTIVE'
        }], { session: isReplicaSet ? session : null });

        // Carry result out of transaction
        result = { userId: user._id, organizationId: organization._id, organizationName };
      };

      if (isReplicaSet) {
        await session.withTransaction(executeOnboarding);
      } else {
        await executeOnboarding();
      }

      // Log onboarding activity AFTER successful commit
      await logActivity({
        userId: result.userId,
        organizationId: result.organizationId,
        action: 'ONBOARDING_COMPLETE',
        details: { organizationName: result.organizationName },
        req
      });

      return await User.findById(result.userId).populate('roleId');
    } catch (err) {
      logger.error('Onboarding Transaction Failed:', err);
      throw err;
    } finally {
      session.endSession();
    }
  },

  /**
   * Signup an organization and create first admin user with 28-day trial
   */
  async register({ email, password, name, organizationName, phoneNumber, ipAddress, deviceFingerprint }) {
    // 1. Fail-fast duplicate checks (Outside transaction for performance and clarity)
    // Use case-insensitive checks for email and organization name
    const [existingEmail, existingPhone, existingOrg] = await Promise.all([
      User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }),
      User.findOne({ phoneNumber }),
      Organization.findOne({ name: { $regex: new RegExp(`^${organizationName}$`, 'i') } })
    ]);

    if (existingEmail) {
      throw new AppError('Email already registered. Please sign in instead.', 409);
    }

    if (existingPhone) {
      throw new AppError('Phone number already registered. Please use another number.', 409);
    }

    if (existingOrg) {
      throw new AppError('Organization name already taken. Please choose another.', 409);
    }

    const session = await mongoose.startSession();

    try {
      let result;
      let isReplicaSet = false;
      try {
        const adminDb = mongoose.connection.db.admin();
        const status = await adminDb.command({ isMaster: 1 });
        isReplicaSet = !!status.setName;
      } catch (e) {
        logger.warn('Could not determine replica set status for registration, defaulting to non-replica set mode');
        isReplicaSet = false;
      }


      const executeRegistration = async () => {
        // 2. Trial Abuse Prevention (Inside transaction for strict safety)
        const existingTrial = await TrialTracking.findOne({
          $or: [
            { email: { $regex: new RegExp(`^${email}$`, 'i') } },
            { phoneNumber }
          ]
        }).session(isReplicaSet ? session : null);

        if (existingTrial) {
          throw new AppError('You have already used your free trial.', 400);
        }
// ... [rest of the function omitted for brevity in instruction, will be handled by tool]

        // 3. Create Organization
        logger.info(`Creating organization: ${organizationName}`);
        const organization = (await Organization.create([{
          name: organizationName
        }], { session: isReplicaSet ? session : null }))[0];

        // 4. Create Default Settings For Organization
        logger.info(`Creating default settings for organization: ${organization._id}`);
        await Settings.create([{
          organizationId: organization._id,
          organization: {
            companyName: organizationName
          },
          branding: {
            organizationName: organizationName
          }
        }], { session: isReplicaSet ? session : null });

        // 5. Create Default Roles
        logger.info(`Creating default roles for organization: ${organization._id}`);
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
          // Check existence first to avoid poisoning the transaction with a write error
          const existingRole = await Role.findOne({ 
            name: roleDef.name, 
            organizationId: organization._id 
          }).session(isReplicaSet ? session : null);

          if (existingRole) {
            if (roleDef.name === 'Admin') adminRole = existingRole;
            continue;
          }

          const r = (await Role.create([{
            ...roleDef,
            organizationId: organization._id
          }], { session: isReplicaSet ? session : null }))[0];
          
          if (roleDef.name === 'Admin') adminRole = r;
        }

        if (!adminRole) {
          throw new AppError('Critical Error: Admin role could not be initialized.', 500);
        }

        // 6. Create Admin User
        logger.info(`Creating admin user: ${email}`);
        const user = (await User.create([{
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
        }], { session: isReplicaSet ? session : null }))[0];

        // 7. Create Trial Subscription
        const subscription = (await Subscription.create([{
          organizationId: organization._id,
          planType: 'TRIAL',
          status: 'ACTIVE'
        }], { session: isReplicaSet ? session : null }))[0];

        // 8. Save Trial Tracking info
        await TrialTracking.create([{
          email,
          phoneNumber,
          ipAddress,
          deviceFingerprint
        }], { session: isReplicaSet ? session : null });

        // Carry result out of transaction
        result = { user, subscription, organizationId: organization._id };
      };

      if (isReplicaSet) {
        await session.withTransaction(executeRegistration);
      } else {
        await executeRegistration();
      }

      // 9. Post-Transaction Operations (Logging)
      await logActivity({
        userId: result.user._id,
        organizationId: result.organizationId,
        action: 'SIGNUP_TRIAL',
        details: { plan: 'TRIAL', organizationName },
        req: { ip: ipAddress, headers: { 'user-agent': deviceFingerprint } }
      });

      return { user: result.user, subscription: result.subscription };
    } catch (err) {
      logger.error('Registration Transaction Failed:', err);
      
      // Detailed error reporting for MongoDB duplicate key errors (code 11000)
      if (err.code === 11000) {
        const fieldMapping = {
          name: 'Organization name',
          email: 'Work Email',
          phoneNumber: 'Phone Number'
        };

        const field = Object.keys(err.keyValue || {})[0] || 'some data';
        let friendlyField = fieldMapping[field] || (field.charAt(0).toUpperCase() + field.slice(1));
        
        throw new AppError(`Conflict detected: ${friendlyField} is already registered or taken.`, 409);
      }
      
      throw err;
    } finally {
      session.endSession();
    }
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
