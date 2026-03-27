'use strict';

const express = require('express');
const router = express.Router();
const roleController = require('./role.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { hasPermission } = require('../../middleware/permission.middleware');

// Publicly accessible for authenticated users (to populate dropdowns)
router.get('/', authenticate, roleController.getAllRoles);

// Restricted to admins
router.post('/', authenticate, hasPermission('UPDATE_POLICY'), roleController.createRole);


module.exports = router;
