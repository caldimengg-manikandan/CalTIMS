'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { authService } = require('./auth.service');

const authController = {
  login: asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    ApiResponse.success(res, {
      message: 'Login successful',
      data: { accessToken, refreshToken, user },
    });
  }),

  refresh: asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(refreshToken);
    ApiResponse.success(res, { message: 'Token refreshed', data: { accessToken, refreshToken: newRefreshToken } });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.user._id);
    ApiResponse.success(res, { message: 'Logged out successfully' });
  }),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(req.user._id, req.body);
    ApiResponse.success(res, { message: 'Password changed successfully. Please log in again.' });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const { resetToken, user } = await authService.forgotPassword(req.body.email);
    // TODO: Send email with reset link
    // await emailService.sendPasswordReset(user.email, resetToken);
    ApiResponse.success(res, { message: 'Password reset link sent to your email' });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.params.token, req.body.password);
    ApiResponse.success(res, { message: 'Password reset successfully. Please log in.' });
  }),
};

module.exports = authController;
