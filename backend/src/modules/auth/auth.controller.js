'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { authService } = require('./auth.service');
const emailService = require('../../shared/services/email.service');
const auditService = require('../audit/audit.service');

const authController = {
  login: asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.login({ ...req.body, req });
    // Audit: track login events
    auditService.log(
      user._id,
      'LOGIN',
      'Auth',
      user._id,
      { email: user.email, role: user.role },
      'SUCCESS',
      req.ip
    ).catch(() => {}); // fire-and-forget, never block the login response

    ApiResponse.success(res, {
      message: 'Login successful',
      data: { accessToken, refreshToken, user },
    });
  }),

  register: asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.register({
      ...req.body,
      ipAddress: req.ip,
      deviceFingerprint: req.headers['user-agent'],
    });
    ApiResponse.created(res, {
      message: 'Organization registered successfully. 28-day free trial started.',
      data: { accessToken, refreshToken, user },
    });
  }),

  refresh: asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshAccessToken(refreshToken);
    ApiResponse.success(res, { message: 'Token refreshed', data: { accessToken, refreshToken: newRefreshToken, user } });
  }),

  logout: asyncHandler(async (req, res) => {
    // Audit: track logout events
    if (req.user?._id) {
      auditService.log(
        req.user._id,
        'LOGOUT',
        'Auth',
        req.user._id,
        {},
        'SUCCESS',
        req.ip
      ).catch(() => {});
    }
    await authService.logout(req.user._id);
    ApiResponse.success(res, { message: 'Logged out successfully' });
  }),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(req.user._id, req.body);
    auditService.log(req.user._id, 'CHANGE_PASSWORD', 'Auth', req.user._id, {}, 'SUCCESS', req.ip).catch(() => {});
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
};

module.exports = authController;
