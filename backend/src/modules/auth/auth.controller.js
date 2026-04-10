'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { authService } = require('./auth.service');
const emailService = require('../../shared/services/email.service');
const auditService = require('../audit/audit.service');

const authController = {
  login: asyncHandler(async (req, res) => {
    const { user, subscription } = await authService.login({ ...req.body, req });
    const { accessToken, refreshToken, user: publicUser } = await authService.generateTokensForUser(user, req);

    // Audit: track login events
    auditService.log(
      publicUser.id,
      'LOGIN',
      'Auth',
      publicUser.id,
      { email: publicUser.email, role: publicUser.role },
      'SUCCESS',
      req.ip
    ).catch(() => {});

    ApiResponse.success(res, {
      message: 'Login successful',
      data: { accessToken, refreshToken, user: publicUser, subscription },
    });
  }),

  socialLogin: asyncHandler(async (req, res) => {
    const user = await authService.socialLogin({ ...req.body, req });
    const { accessToken, refreshToken, user: publicUser } = await authService.generateTokensForUser(user, req);
    
    ApiResponse.success(res, {
      message: user.isNew ? 'Account created successfully' : 'Login successful',
      data: { accessToken, refreshToken, user: publicUser },
    });
  }),

  completeOnboarding: asyncHandler(async (req, res) => {
    const user = await authService.completeOnboarding(req.user.id, { ...req.body, req });
    
    ApiResponse.success(res, {
      message: 'Onboarding completed successfully',
      data: { user },
    });
  }),

  register: asyncHandler(async (req, res) => {
    const { user, subscription } = await authService.register({
      ...req.body,
      ipAddress: req.ip,
      deviceFingerprint: req.headers['user-agent'],
    });

    const { accessToken, refreshToken, user: publicUser } = await authService.generateTokensForUser(user, req);

    ApiResponse.created(res, {
      message: 'Organization registered successfully. 28-day free trial started.',
      data: { accessToken, refreshToken, user: publicUser, subscription },
    });
  }),

  refresh: asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshAccessToken(refreshToken);
    ApiResponse.success(res, { message: 'Token refreshed', data: { accessToken, refreshToken: newRefreshToken, user } });
  }),

  logout: asyncHandler(async (req, res) => {
    // Audit: track logout events
    if (req.user?.id) {
      auditService.log(
        req.user.id,
        'LOGOUT',
        'Auth',
        req.user.id,
        {},
        'SUCCESS',
        req.ip
      ).catch(() => {});
    }
    await authService.logout(req.user.id);
    ApiResponse.success(res, { message: 'Logged out successfully' });
  }),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(req.user.id, req.body);
    auditService.log(req.user.id, 'CHANGE_PASSWORD', 'Auth', req.user.id, {}, 'SUCCESS', req.ip).catch(() => {});
    ApiResponse.success(res, { message: 'Password changed successfully. Please log in again.' });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const { resetToken, user } = await authService.forgotPassword(req.body.email);
    await emailService.sendPasswordReset(user.email, user.name, resetToken);
    ApiResponse.success(res, { message: 'Password reset link sent to your email' });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.params.token, req.body.password);
    ApiResponse.success(res, { message: 'Password reset successfully. Please log in.' });
  }),

  googleCallback: asyncHandler(async (req, res) => {
    // passport.authenticate already attached the user document to req.user
    const { accessToken, refreshToken, user } = await authService.generateTokensForUser(req.user, req);
    
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    
    // Logic-based redirect: if no organization, user must complete onboarding
    const targetPath = user.organizationId ? '/dashboard' : '/onboarding';
    const redirectUrl = `${clientUrl}${targetPath}?token=${accessToken}&refreshToken=${refreshToken}`;
    
    res.redirect(redirectUrl);
  }),

  microsoftCallback: asyncHandler(async (req, res) => {
    // passport.authenticate already attached the user document to req.user
    const { accessToken, refreshToken, user } = await authService.generateTokensForUser(req.user, req);
    
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    
    // Logic-based redirect: if no organization, user must complete onboarding
    const targetPath = user.organizationId ? '/dashboard' : '/onboarding';
    const redirectUrl = `${clientUrl}${targetPath}?token=${accessToken}&refreshToken=${refreshToken}`;
    
    res.redirect(redirectUrl);
  }),
};

module.exports = authController;
