'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const timesheetService = require('./timesheet.service');

const timesheetController = {
  create: asyncHandler(async (req, res) => {
    const ts = await timesheetService.create(req.body, req.user._id, req.organizationId);
    ApiResponse.created(res, { message: 'Timesheet created', data: ts });
  }),

  getAll: asyncHandler(async (req, res) => {
    const { timesheets, pagination, holidays } = await timesheetService.getAll(req.query, req.user, req.organizationId);
    ApiResponse.success(res, { data: timesheets, pagination, holidays });
  }),

  getById: asyncHandler(async (req, res) => {
    const ts = await timesheetService.getById(req.params.id, req.user, req.organizationId);
    ApiResponse.success(res, { data: ts });
  }),

  update: asyncHandler(async (req, res) => {
    const ts = await timesheetService.update(req.params.id, req.body, req.user._id, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheet updated', data: ts });
  }),

  submit: asyncHandler(async (req, res) => {
    const ts = await timesheetService.submit(req.params.id, req.user, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheet submitted for approval', data: ts });
  }),

  approve: asyncHandler(async (req, res) => {
    const ts = await timesheetService.approve(req.params.id, req.user._id, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheet approved', data: ts });
  }),

  reject: asyncHandler(async (req, res) => {
    const ts = await timesheetService.reject(req.params.id, req.user._id, req.body.reason, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheet rejected', data: ts });
  }),

  delete: asyncHandler(async (req, res) => {
    await timesheetService.delete(req.params.id, req.user, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheet deleted' });
  }),

  getDashboardSummary: asyncHandler(async (req, res) => {
    const summary = await timesheetService.getDashboardSummary(req.user._id, req.user.role, req.organizationId, req.query);
    ApiResponse.success(res, { data: summary });
  }),

  bulkUpsert: asyncHandler(async (req, res) => {
    const timesheets = await timesheetService.bulkUpsert(req.body, req.user._id, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheets saved', data: timesheets });
  }),

  bulkSubmit: asyncHandler(async (req, res) => {
    const timesheets = await timesheetService.bulkSubmit(req.body, req.user._id, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheets submitted', data: timesheets });
  }),

  adminFill: asyncHandler(async (req, res) => {
    const { targetUserId, rows } = req.body;
    const timesheets = await timesheetService.adminFill(rows, targetUserId, req.user._id, req.organizationId);
    ApiResponse.success(res, { message: 'Timesheets filled by admin successfully', data: timesheets });
  }),

  getHistory: asyncHandler(async (req, res) => {
    const { data, pagination } = await timesheetService.getHistory(req.query, req.user, req.organizationId);
    ApiResponse.success(res, { data, pagination });
  }),

  getCompliance: asyncHandler(async (req, res) => {
    const { data, pagination } = await timesheetService.getCompliance(req.query, req.organizationId);
    ApiResponse.success(res, { data, pagination });
  }),

  getAdminSummary: asyncHandler(async (req, res) => {
    const summary = await timesheetService.getAdminSummary(req.organizationId);
    ApiResponse.success(res, { data: summary });
  }),

  getAdminKpiSummary: asyncHandler(async (req, res) => {
    const summary = await timesheetService.getAdminKpiSummary(req.query.kpi || 'project-hours', req.organizationId);
    ApiResponse.success(res, { data: summary });
  }),

  getAdminTimesheets: asyncHandler(async (req, res) => {
    const { data, pagination } = await timesheetService.getAdminTimesheets(req.query, req.organizationId);
    ApiResponse.success(res, { data, pagination });
  }),

  getAdminFilterOptions: asyncHandler(async (req, res) => {
    const options = await timesheetService.getAdminFilterOptions(req.organizationId);
    ApiResponse.success(res, { data: options });
  }),
};

module.exports = timesheetController;
