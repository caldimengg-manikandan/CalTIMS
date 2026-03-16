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
      const result = await hikvisionService.syncDevice(deviceId);
      results = [{ deviceId, ...result }];
    } else {
      results = await hikvisionService.syncAllDevices();
    }

    ApiResponse.success(res, { message: 'Manual sync completed', data: results });
  }),

  /**
   * CRUD for Devices
   */
  getDevices: asyncHandler(async (req, res) => {
    const devices = await Device.find();
    ApiResponse.success(res, { data: devices });
  }),

  createDevice: asyncHandler(async (req, res) => {
    const device = await Device.create(req.body);
    ApiResponse.success(res, { message: 'Device created successfully', data: device });
  }),

  updateDevice: asyncHandler(async (req, res) => {
    const device = await Device.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!device) throw new AppError('Device not found', 404);
    ApiResponse.success(res, { message: 'Device updated successfully', data: device });
  }),

  deleteDevice: asyncHandler(async (req, res) => {
    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) throw new AppError('Device not found', 404);
    ApiResponse.success(res, { message: 'Device deleted successfully' });
  })
};

module.exports = hikvisionController;
