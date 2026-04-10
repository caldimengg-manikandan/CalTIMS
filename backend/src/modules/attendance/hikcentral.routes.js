'use strict';

const express = require('express');
const router = express.Router();
const hikcentralService = require('./hikcentral.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkPermission } = require('../../middleware/rbac.middleware');
const ApiResponse = require('../../shared/utils/apiResponse');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.use(authenticate);

/**
 * Test connection to HikCentral
 */
router.post('/test', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const result = await hikcentralService.testConnection(req.body);
  if (result.success) {
    ApiResponse.success(res, { message: result.message, data: result.data });
  } else {
    res.status(400).json({ success: false, message: result.message, error: result.error });
  }
}));

/**
 * Manual trigger sync for HikCentral
 */
router.post('/sync', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const results = await hikcentralService.syncAll();
  ApiResponse.success(res, { message: 'Manual sync for HikCentral completed', data: results });
}));

module.exports = router;
