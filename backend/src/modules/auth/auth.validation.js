'use strict';

const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).required(),
  macAddress: Joi.string().trim(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().trim().required(),
  organizationName: Joi.string().trim().required(),
  phoneNumber: Joi.string().pattern(/^\d{10}$/).trim().required().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits',
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
  }),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
