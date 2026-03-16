'use strict';

const Joi = require('joi');
const { ROLES } = require('../../constants');

const createUserSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid(...Object.values(ROLES)).default('employee'),
  department: Joi.string().trim().max(100),
  designation: Joi.string().trim().max(100),
  managerId: Joi.string().hex().length(24).allow(null, ''),
  phone: Joi.string().trim().max(20),
  employeeId: Joi.string().trim().max(50),
  joinDate: Joi.date().iso(),
});

const updateUserSchema = Joi.object({
  name: Joi.string().trim().max(100),
  department: Joi.string().trim().max(100),
  designation: Joi.string().trim().max(100),
  managerId: Joi.string().hex().length(24).allow(null, ''),
  phone: Joi.string().trim().max(20),
  employeeId: Joi.string().trim().max(50),
  avatar: Joi.string().uri(),
  role: Joi.string().valid(...Object.values(ROLES)),
  leaveBalance: Joi.object({
    annual: Joi.number().min(0),
    sick: Joi.number().min(0),
    casual: Joi.number().min(0),
  }),
}).min(1).unknown(true);

const changeRoleSchema = Joi.object({
  role: Joi.string().valid(...Object.values(ROLES)).required(),
});

module.exports = { createUserSchema, updateUserSchema, changeRoleSchema };
