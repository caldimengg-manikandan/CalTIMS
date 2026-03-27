'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { permit } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants');

// All admin routes require super_admin role
router.use(authenticate);
router.use(permit(ROLES.SUPER_ADMIN));

router.get('/dashboard-metrics', adminController.getDashboardMetrics);
router.get('/organizations', adminController.getAllOrganizations);

module.exports = router;
