'use strict';

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const passport = require('passport');
const {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.validation');

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/social-login', authController.socialLogin);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), authController.resetPassword);
router.post('/forgot-password-otp', authController.forgotPasswordOTP);
router.post('/verify-reset-otp', authController.verifyResetOTP);
router.post('/reset-password-otp', authController.resetPasswordWithOTP);
router.post('/send-verification-otp', authController.sendVerificationOTP);
router.post('/verify-verification-otp', authController.verifyVerificationOTP);

// Google OAuth 2.0
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }), authController.googleCallback);

// Microsoft OAuth 2.0
router.get('/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));
router.get('/microsoft/callback', passport.authenticate('microsoft', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }), authController.microsoftCallback);

// Protected routes
router.use(authenticate);
router.post('/logout', authController.logout);
router.post('/change-password', validate(changePasswordSchema), authController.changePassword);
router.post('/onboarding', authController.completeOnboarding);

module.exports = router;
