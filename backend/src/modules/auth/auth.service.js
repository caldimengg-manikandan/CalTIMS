'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { logActivity } = require('../../shared/utils/activityLogger');
const logger = require('../../shared/utils/logger');
const { ROLES } = require('../../constants');
const otpService = require('../../shared/services/otp.service');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m',
  });
  const refreshToken = jwt.sign({ sub: userId, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const saltRounds = () => parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

const authService = {
  /**
   * Email/password login
   */
  async login({ email, password }) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { roleRef: true },
    });

    if (!user || !user.password) throw new AppError('Invalid email or password', 401);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Invalid email or password', 401);

    if (!user.isActive) throw new AppError('Your account has been deactivated. Contact your administrator.', 403);

    const subscription = user.organizationId
      ? await prisma.subscription.findFirst({ where: { organizationId: user.organizationId } })
      : null;

    return { user, subscription };
  },

  /**
   * Social Login (Google/Microsoft)
   */
  async socialLogin({ email, name, provider }) {
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { roleRef: true },
    });

    if (user) {
      if (!user.providers.includes(provider)) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { providers: { push: provider } },
          include: { roleRef: true },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name,
          provider,
          providers: [provider],
          isOnboardingComplete: false,
          isActive: true,
          role: 'employee',
        },
        include: { roleRef: true },
      });
    }

    if (!user.isActive) throw new AppError('Your account has been deactivated.', 403);
    return user;
  },

  /**
   * Complete onboarding — create org, roles, settings
   */
  async completeOnboarding(userId, { organizationName, phoneNumber, req }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.isOnboardingComplete) throw new AppError('Onboarding already completed', 400);

    const errors = {};
    const existingOrg = await prisma.organization.findFirst({
      where: { name: { equals: organizationName, mode: 'insensitive' } },
    });
    if (existingOrg) errors.organizationName = 'An organization with this name already exists.';

    if (phoneNumber) {
      const existingPhone = await prisma.user.findFirst({ where: { phoneNumber } });
      if (existingPhone && existingPhone.id !== userId) {
        errors.phoneNumber = `${phoneNumber} ALREADY TAKEN`;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError('Validation failed', 409, errors);
    }

    // Create org
    const slug = organizationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    const org = await prisma.organization.create({
      data: { name: organizationName, slug },
    });

    // Create default roles
    const roleData = [
      { name: 'Admin', permissions: { all: { all: ['all'] } } },
      { name: 'Employee', permissions: { timesheets: { entry: ['view', 'create', 'edit'] } } },
      { name: 'Finance', permissions: { payroll: { all: ['view', 'approve'] } } },
    ];

    let adminRole = null;
    for (const rd of roleData) {
      const r = await prisma.role.create({ data: { ...rd, organizationId: org.id } });
      if (rd.name === 'Admin') adminRole = r;
    }

    // Create settings
    await prisma.orgSettings.create({
      data: {
        organizationId: org.id,
        data: {
          organization: { companyName: organizationName },
          branding: { organizationName },
        },
      },
    });

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: org.id,
        role: ROLES.ADMIN,
        roleId: adminRole?.id || null,
        phone: phoneNumber || null,
        phoneNumber: phoneNumber || null,
        isOwner: true,
        isOnboardingComplete: true,
      },
      include: { roleRef: true },
    });

    // Create trial subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 28);
    await prisma.subscription.create({
      data: { organizationId: org.id, planType: 'TRIAL', status: 'ACTIVE', trialEndDate: trialEnd },
    });

    await logActivity({ userId, organizationId: org.id, action: 'ONBOARDING_COMPLETE', details: { organizationName }, req });

    return updatedUser;
  },

  /**
   * Register — create org + user + trial
   */
  async register({ email, password, name, organizationName, phoneNumber, ipAddress, deviceFingerprint, otp }) {
    // Verify Email OTP
    await otpService.verifyOTP(email, otp);

    const [existingEmail, existingPhone, existingOrg, existingTrial] = await Promise.all([
      prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } }),
      phoneNumber ? prisma.user.findFirst({ where: { phoneNumber } }) : null,
      prisma.organization.findFirst({ where: { name: { equals: organizationName, mode: 'insensitive' } } }),
      prisma.trialTracking.findFirst({
        where: { OR: [{ email: email.toLowerCase().trim() }, phoneNumber ? { phoneNumber } : undefined].filter(Boolean) },
      }),
    ]);

    const errors = {};
    if (existingEmail) errors.email = `${email} ALREADY TAKEN`;
    if (existingPhone) errors.phoneNumber = `${phoneNumber} ALREADY TAKEN`;
    if (existingOrg) errors.organizationName = 'An organization with this name already exists.';
    if (existingTrial) errors.trial = 'You have already used your free trial.';

    if (Object.keys(errors).length > 0) {
      throw new AppError('Validation failed', 409, errors);
    }

    // Create org
    const slug = organizationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    const org = await prisma.organization.create({ data: { name: organizationName, slug } });

    // Settings
    await prisma.orgSettings.create({
      data: {
        organizationId: org.id,
        data: { organization: { companyName: organizationName }, branding: { organizationName } },
      },
    });

    // Roles
    const roleData = [
      { name: 'Admin', permissions: { all: { all: ['all'] } } },
      { name: 'Employee', permissions: { timesheets: { entry: ['view', 'create', 'edit'] } } },
      { name: 'Finance', permissions: { payroll: { all: ['view', 'approve'] } } },
    ];
    let adminRole = null;
    for (const rd of roleData) {
      const r = await prisma.role.create({ data: { ...rd, organizationId: org.id } });
      if (rd.name === 'Admin') adminRole = r;
    }

    // Create user
    const hashed = await bcrypt.hash(password, saltRounds());
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        name,
        phone: phoneNumber || null,
        phoneNumber: phoneNumber || null,
        organizationId: org.id,
        role: ROLES.OWNER,
        roleId: adminRole?.id || null,
        provider: 'local',
        providers: ['local'],
        isActive: true,
        isOnboardingComplete: true,
        isOwner: true,
        lastLogin: new Date(),
      },
      include: { roleRef: true },
    });

    // Cleanup OTP
    await otpService.deleteOTP(email);

    // Employee code
    await prisma.employee.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        employeeCode: 'EMP0001',
        status: 'ACTIVE',
        joiningDate: new Date(),
      },
    });

    // Trial subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 28);
    const subscription = await prisma.subscription.create({
      data: { organizationId: org.id, planType: 'TRIAL', status: 'ACTIVE', trialEndDate: trialEnd },
    });

    // Record trial
    await prisma.trialTracking.create({
      data: { organizationId: org.id, email: user.email, phoneNumber: phoneNumber || user.email, ipAddress, deviceFingerprint },
    });

    await logActivity({
      userId: user.id,
      organizationId: org.id,
      action: 'SIGNUP_TRIAL',
      details: { plan: 'TRIAL', organizationName },
      req: { ip: ipAddress, headers: { 'user-agent': deviceFingerprint } },
    });

    return { user, subscription };
  },

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new AppError('Refresh token not provided', 401);

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { roleRef: true },
    });

    if (!user || !user.isActive) throw new AppError('User not found or deactivated', 401);

    const tokenHash = hashToken(refreshToken);
    if (user.refreshTokenHash !== tokenHash) {
      await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      throw new AppError('Token reuse detected. Please log in again.', 401);
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashToken(newRefreshToken) } });

    return { accessToken, refreshToken: newRefreshToken, user: formatUser(user) };
  },

  async logout(userId) {
    await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (!user.password) throw new AppError('Password login not available for OAuth accounts', 400);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 401);
    const hashed = await bcrypt.hash(newPassword, saltRounds());
    await prisma.user.update({ where: { id: userId }, data: { password: hashed, passwordChangedAt: new Date(), refreshTokenHash: null } });
    return true;
  },

  async forgotPassword(email) {
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim(), isActive: true } });
    if (!user) throw new AppError('No user with this email address', 404);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { passwordResetToken: hashed, passwordResetExpires: expires } });
    return { resetToken, user };
  },

  async resetPassword(token, newPassword) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: hashed, passwordResetExpires: { gt: new Date() } },
    });
    if (!user) throw new AppError('Token is invalid or has expired', 400);
    const newHashed = await bcrypt.hash(newPassword, saltRounds());
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHashed,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshTokenHash: null,
        passwordChangedAt: new Date(),
      },
    });
    return true;
  },

  async generateTokensForUser(user, req) {
    const userId = user.id || user.id;
    const freshUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roleRef: true },
    });
    if (!freshUser) throw new AppError('User not found during token generation', 404);
    if (!freshUser.isActive) throw new AppError('Your account has been deactivated.', 403);

    const { accessToken, refreshToken } = generateTokens(freshUser.id, freshUser.role);
    await prisma.user.update({
      where: { id: freshUser.id },
      data: { lastLogin: new Date(), refreshTokenHash: hashToken(refreshToken) },
    });

    await logActivity({ userId: freshUser.id, organizationId: freshUser.organizationId, action: 'LOGIN', req });

    return { accessToken, refreshToken, user: formatUser(freshUser) };
  },

  async sendVerificationOTP(email) {
    return await otpService.sendOTP(email, 'Signup Verification');
  },

  async verifyVerificationOTP(email, otp) {
    return await otpService.verifyOTP(email, otp);
  },

  async forgotPasswordOTP(email) {
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim(), isActive: true } });
    if (!user) throw new AppError('No user with this email address', 404);
    
    // Send OTP via otpService
    return await otpService.sendOTP(email, 'Password Recovery');
  },

  async verifyResetOTP(email, otp) {
    return await otpService.verifyOTP(email, otp);
  },

  async resetPasswordWithOTP(email, otp, newPassword) {
    // 1. Verify OTP again (it shouldn't have been deleted if logic follows)
    await otpService.verifyOTP(email, otp);
    
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new AppError('User not found', 404);
    
    const hashed = await bcrypt.hash(newPassword, saltRounds());
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshTokenHash: null,
        passwordChangedAt: new Date(),
      },
    });
    
    // 2. Delete OTP after successful reset
    await otpService.deleteOTP(email);
    
    return true;
  },
};

function formatUser(u) {
  if (!u) return null;
  const raw = u.roleRef?.permissions || {};
  const role = (u.role || '').toLowerCase();
  
  // Hardcoded fallbacks matching user.service.js
  const defaultPermissions = {
    'admin': { all: true },
    'super_admin': { all: true },
    'owner': { all: true },
    'manager': { 
      "Timesheets": { "Dashboard": ["view"], "Entry": ["view", "create", "edit"], "History": ["view"], "Management": ["view", "approve", "reject"] },
      "Leave Management": { "Leave Tracker": ["view"] },
      "My Payslip": { "Payslip View": ["view", "download"] },
      "Support": { "Help & Support": ["view"] }
    },
    'hr': { 
      "Payroll": { "Dashboard": ["view"], "Payroll Engine": ["view", "run", "submit"], "Payslip Generation": ["view", "generate"], "Payroll Reports": ["view"] },
      "Employees": { "Employee List": ["view", "create", "edit", "delete"], "Management": ["view", "edit"] },
      "Leave Management": { "Leave Tracker": ["view"], "Leave Requests": ["view", "create", "approve", "reject"] },
      "Timesheets": { "Dashboard": ["view"], "Management": ["view", "approve", "reject"] },
      "Announcements": { "Announcements": ["view", "create", "edit"] }
    },
    'finance': { 
      "Payroll": { "Dashboard": ["view"], "Payroll Engine": ["view", "approve", "disburse"], "Bank Export": ["view", "export"], "Payroll Reports": ["view", "export"] },
      "Reports": { "Reports Dashboard": ["view", "export"] },
      "My Payslip": { "Payslip View": ["view", "download"] }
    },
    'employee': { 
      "Timesheets": { "Dashboard": ["view"], "Entry": ["view", "create", "edit"], "History": ["view"] },
      "My Payslip": { "Payslip View": ["view", "download"] },
      "Leave Management": { "Leave Tracker": ["view"] },
      "Support": { "Help & Support": ["view"] }
    }
  };

  let permissions = raw;
  if (['admin', 'manager', 'hr', 'finance', 'employee'].includes(role) && defaultPermissions[role]) {
    const merged = { ...defaultPermissions[role] };
    Object.keys(raw).forEach(module => {
      if (typeof raw[module] === 'object' && !Array.isArray(raw[module]) && raw[module] !== null) {
        merged[module] = { ...(merged[module] || {}), ...raw[module] };
      } else {
        merged[module] = raw[module];
      }
    });
    permissions = merged;
  } else if (Object.keys(raw).length === 0) {
    permissions = defaultPermissions[role] || {};
  }

  return {
    id: u.id,
    _id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleId: u.roleId,
    roleName: u.roleRef?.name,
    permissions,
    organizationId: u.organizationId,
    phone: u.phone,
    phoneNumber: u.phoneNumber,
    isActive: u.isActive,
    isOwner: u.isOwner,
    isOnboardingComplete: u.isOnboardingComplete,
    provider: u.provider,
    providers: u.providers,
    avatar: u.avatar,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
    bankName: u.bankName,
    accountNumber: u.accountNumber,
    branchName: u.branchName,
    ifscCode: u.ifscCode,
    uan: u.uan,
    pan: u.pan,
    aadhaar: u.aadhaar,
  };
}

module.exports = { authService, generateTokens };
