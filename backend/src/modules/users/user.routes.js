'use strict';

const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, authorizeOwnerOrRole, checkPermission } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createUserSchema, updateUserSchema, changeRoleSchema } = require('./user.validation');

// All user routes require auth
router.use(authenticate);

// My profile
router.get('/me', userController.getMe);

// List employees (admin/manager/HR)
router.get('/', checkPermission('manageEmployees'), userController.getAll);

// Get all unique departments
router.get('/departments', checkPermission('manageEmployees'), userController.getDepartments);

// Create employee (admin/manager/HR)
router.post('/', checkPermission('manageEmployees'), validate(createUserSchema), userController.create);

// Get specific employee
router.get('/:id', checkPermission('manageEmployees'), userController.getById);

// Update profile (admin or self)
router.put('/:id', validate(updateUserSchema), userController.update);

// Reset password (admin/manager/HR)
router.post('/:id/reset-password', checkPermission('manageEmployees'), userController.resetPassword);

// Deactivate employee (admin/manager/HR)
router.patch('/:id/deactivate', checkPermission('manageEmployees'), userController.deactivate);

// Activate employee (admin/manager/HR)
router.patch('/:id/activate', checkPermission('manageEmployees'), userController.activate);

// Change role (admin/manager/HR)
router.patch('/:id/role', checkPermission('manageEmployees'), validate(changeRoleSchema), userController.changeRole);

// Delete employee (admin only - destructive action)
router.delete('/:id', authorize('admin'), userController.delete);

module.exports = router;
