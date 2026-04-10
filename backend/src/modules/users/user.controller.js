'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const userService = require('./user.service');
const auditService = require('../audit/audit.service');
const { HTTP_STATUS } = require('../../constants');

const userController = {
  getAll: asyncHandler(async (req, res) => {
    const { users, pagination } = await userService.getAll(req.query, req.context);
    ApiResponse.success(res, { data: users, pagination });
  }),

  getById: asyncHandler(async (req, res) => {
    const user = await userService.getById(req.params.id, req.context.organizationId);
    ApiResponse.success(res, { data: user });
  }),

  getMe: asyncHandler(async (req, res) => {
    const user = await userService.getMe(req.context.userId, req.context.organizationId);
    ApiResponse.success(res, { data: user });
  }),

  create: asyncHandler(async (req, res) => {
    const user = await userService.create(req.body, req.context, req.ip);
    auditService.log(
      req.context.userId,
      'CREATE_EMPLOYEE',
      'Employee',
      user.id,
      { name: user.name, email: user.email },
      'SUCCESS',
      req.ip
    ).catch(() => {});
    ApiResponse.created(res, { message: 'Employee created successfully', data: user });
  }),

  update: asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body, req.context);
    auditService.log(
      req.context.userId,
      'UPDATE_EMPLOYEE',
      'Employee',
      req.params.id,
      { updatedFields: Object.keys(req.body) },
      'SUCCESS',
      req.ip
    ).catch(() => {});
    ApiResponse.success(res, { message: 'Profile updated successfully', data: user });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    if (!req.body.password || req.body.password.length < 8) {
      throw new (require('../../shared/utils/AppError'))('Password must be at least 8 characters', 400);
    }
    await userService.resetPassword(req.params.id, req.body.password, req.context.organizationId);
    auditService.log(req.context.userId, 'RESET_EMPLOYEE_PASSWORD', 'Employee', req.params.id, {}, 'SUCCESS', req.ip).catch(() => {});
    ApiResponse.success(res, { message: 'Password reset successfully' });
  }),

  deactivate: asyncHandler(async (req, res) => {
    const user = await userService.deactivate(req.params.id, req.context.organizationId);
    auditService.log(req.context.userId, 'DEACTIVATE_EMPLOYEE', 'Employee', req.params.id, {}, 'SUCCESS', req.ip).catch(() => {});
    ApiResponse.success(res, { message: 'Employee deactivated', data: user });
  }),

  activate: asyncHandler(async (req, res) => {
    const user = await userService.activate(req.params.id, req.context.organizationId);
    auditService.log(req.context.userId, 'ACTIVATE_EMPLOYEE', 'Employee', req.params.id, {}, 'SUCCESS', req.ip).catch(() => {});
    ApiResponse.success(res, { message: 'Employee activated', data: user });
  }),

  changeRole: asyncHandler(async (req, res) => {
    const user = await userService.changeRole(req.params.id, req.body.role, req.context.organizationId);
    auditService.log(req.context.userId, 'CHANGE_EMPLOYEE_ROLE', 'Employee', req.params.id, { newRole: req.body.role }, 'SUCCESS', req.ip).catch(() => {});
    ApiResponse.success(res, { message: 'Role updated successfully', data: user });
  }),

  delete: asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id, req.context.organizationId);
    auditService.log(req.context.userId, 'DELETE_EMPLOYEE', 'Employee', req.params.id, {}, 'SUCCESS', req.ip).catch(() => {});
    ApiResponse.success(res, { message: 'Employee deleted successfully' });
  }),

  getDepartments: asyncHandler(async (req, res) => {
    const departments = await userService.getDepartments(req.context.organizationId);
    ApiResponse.success(res, { data: departments });
  }),

  getRoles: asyncHandler(async (req, res) => {
    const roles = await userService.getRoles(req.context.organizationId);
    ApiResponse.success(res, { data: roles });
  }),
};

module.exports = userController;
