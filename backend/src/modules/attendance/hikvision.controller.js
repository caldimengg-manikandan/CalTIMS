'use strict';

const hikvisionService = require('./hikvision.service');
const Device = require('./device.model');
const ApiResponse = require('../../shared/utils/apiResponse');
const asyncHandler = require('../../shared/utils/asyncHandler');
const AppError = require('../../shared/utils/AppError');

const hikvisionController = {
  /**
   * Test connection to a Hikvision device.
   */
  testConnection: asyncHandler(async (req, res) => {
    const result = await hikvisionService.testConnection(req.body);
    if (result.success) {
      ApiResponse.success(res, { message: result.message, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message, error: result.error });
    }
  }),

  /**
   * Manually trigger sync for all devices or a specific one.
   */
  manualSync: asyncHandler(async (req, res) => {
    const { deviceId } = req.body;
    let results;

    if (deviceId) {
      const result = await hikvisionService.syncDevice(deviceId, { organizationId: req.organizationId });
      results = [{ deviceId, ...result }];
    } else {
      results = await hikvisionService.syncAllDevices({ organizationId: req.organizationId });
    }

    ApiResponse.success(res, { message: 'Manual sync completed', data: results });
  }),

  /**
   * CRUD for Devices
   */
  getDevices: asyncHandler(async (req, res) => {
    const devices = await Device.find({ organizationId: req.organizationId });
    ApiResponse.success(res, { data: devices });
  }),

  createDevice: asyncHandler(async (req, res) => {
    const device = await Device.create({ ...req.body, organizationId: req.organizationId });
    ApiResponse.success(res, { message: 'Device created successfully', data: device });
  }),

  updateDevice: asyncHandler(async (req, res) => {
    const device = await Device.findOneAndUpdate({ _id: req.params.id, organizationId: req.organizationId }, req.body, { new: true });
    if (!device) throw new AppError('Device not found', 404);
    ApiResponse.success(res, { message: 'Device updated successfully', data: device });
  }),

  deleteDevice: asyncHandler(async (req, res) => {
    const device = await Device.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!device) throw new AppError('Device not found', 404);
    ApiResponse.success(res, { message: 'Device deleted successfully' });
  })
};

module.exports = hikvisionController;
