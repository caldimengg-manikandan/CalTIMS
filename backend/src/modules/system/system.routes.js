'use strict';

const express = require('express');
const systemController = require('./system.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

const router = express.Router();

// GET current version (authenticated users only)
router.get('/version', authenticate, systemController.getSystemVersion);

// PATCH version (Restricted to Admins)
router.patch('/version', authenticate, authorize('admin'), systemController.updateSystemVersion);

module.exports = router;
