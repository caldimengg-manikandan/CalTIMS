'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const timesheetService = require('./timesheet.service');

const timesheetController = {
  create: asyncHandler(async (req, res) => {
    const ts = await timesheetService.create(req.body, req.user._id);
    ApiResponse.created(res, { message: 'Timesheet created', data: ts });
  }),

  getAll: asyncHandler(async (req, res) => {
    const { timesheets, pagination } = await timesheetService.getAll(req.query, req.user);
    ApiResponse.success(res, { data: timesheets, pagination });
  }),

  getById: asyncHandler(async (req, res) => {
    const ts = await timesheetService.getById(req.params.id, req.user);
    ApiResponse.success(res, { data: ts });
  }),

  update: asyncHandler(async (req, res) => {
    const ts = await timesheetService.update(req.params.id, req.body, req.user._id);
    ApiResponse.success(res, { message: 'Timesheet updated', data: ts });
  }),

  submit: asyncHandler(async (req, res) => {
    const ts = await timesheetService.submit(req.params.id, req.user);
    ApiResponse.success(res, { message: 'Timesheet submitted for approval', data: ts });
  }),

  approve: asyncHandler(async (req, res) => {
    const ts = await timesheetService.approve(req.params.id, req.user._id);
    ApiResponse.success(res, { message: 'Timesheet approved', data: ts });
  }),

  reject: asyncHandler(async (req, res) => {
    const ts = await timesheetService.reject(req.params.id, req.user._id, req.body.reason);
    ApiResponse.success(res, { message: 'Timesheet rejected', data: ts });
  }),

  delete: asyncHandler(async (req, res) => {
    await timesheetService.delete(req.params.id, req.user);
    ApiResponse.success(res, { message: 'Timesheet deleted' });
  }),

  getDashboardSummary: asyncHandler(async (req, res) => {
    const summary = await timesheetService.getDashboardSummary(req.user._id, req.user.role, req.query);
    ApiResponse.success(res, { data: summary });
  }),

  bulkUpsert: asyncHandler(async (req, res) => {
    const timesheets = await timesheetService.bulkUpsert(req.body, req.user._id);
    ApiResponse.success(res, { message: 'Timesheets saved', data: timesheets });
  }),

  bulkSubmit: asyncHandler(async (req, res) => {
    const timesheets = await timesheetService.bulkSubmit(req.body, req.user._id);
    ApiResponse.success(res, { message: 'Timesheets submitted', data: timesheets });
  }),

  getHistory: asyncHandler(async (req, res) => {
    const { data, pagination } = await timesheetService.getHistory(req.query, req.user);
    ApiResponse.success(res, { data, pagination });
  }),

  getAdminSummary: asyncHandler(async (req, res) => {
    const summary = await timesheetService.getAdminSummary();
    ApiResponse.success(res, { data: summary });
  }),

  getAdminKpiSummary: asyncHandler(async (req, res) => {
    const summary = await timesheetService.getAdminKpiSummary(req.query.kpi || 'project-hours');
    ApiResponse.success(res, { data: summary });
  }),

  getAdminTimesheets: asyncHandler(async (req, res) => {
    const { data, pagination } = await timesheetService.getAdminTimesheets(req.query);
    ApiResponse.success(res, { data, pagination });
  }),

  getAdminFilterOptions: asyncHandler(async (req, res) => {
    const options = await timesheetService.getAdminFilterOptions();
    ApiResponse.success(res, { data: options });
  }),
};

module.exports = timesheetController;
