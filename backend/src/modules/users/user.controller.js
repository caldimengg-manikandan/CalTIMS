'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const userService = require('./user.service');
const { HTTP_STATUS } = require('../../constants');

const userController = {
  getAll: asyncHandler(async (req, res) => {
    const { users, pagination } = await userService.getAll(req.query);
    ApiResponse.success(res, { data: users, pagination });
  }),

  getById: asyncHandler(async (req, res) => {
    const user = await userService.getById(req.params.id);
    ApiResponse.success(res, { data: user });
  }),

  getMe: asyncHandler(async (req, res) => {
    const user = await userService.getMe(req.user._id);
    ApiResponse.success(res, { data: user });
  }),

  create: asyncHandler(async (req, res) => {
    const user = await userService.create(req.body);
    ApiResponse.created(res, { message: 'Employee created successfully', data: user });
  }),

  update: asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body, req.user._id, req.user.role);
    ApiResponse.success(res, { message: 'Profile updated successfully', data: user });
  }),

  deactivate: asyncHandler(async (req, res) => {
    const user = await userService.deactivate(req.params.id);
    ApiResponse.success(res, { message: 'Employee deactivated', data: user });
  }),

  activate: asyncHandler(async (req, res) => {
    const user = await userService.activate(req.params.id);
    ApiResponse.success(res, { message: 'Employee activated', data: user });
  }),

  changeRole: asyncHandler(async (req, res) => {
    const user = await userService.changeRole(req.params.id, req.body.role);
    ApiResponse.success(res, { message: 'Role updated successfully', data: user });
  }),

  delete: asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id);
    ApiResponse.success(res, { message: 'Employee deleted successfully' });
  }),

  getDepartments: asyncHandler(async (req, res) => {
    const departments = await userService.getDepartments();
    ApiResponse.success(res, { data: departments });
  }),
};

module.exports = userController;
