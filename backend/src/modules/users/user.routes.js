'use strict';

const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, authorizeOwnerOrRole } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createUserSchema, updateUserSchema, changeRoleSchema } = require('./user.validation');

// All user routes require auth
router.use(authenticate);

// My profile
router.get('/me', userController.getMe);

// List employees (admin/manager)
router.get('/', authorize('admin', 'manager'), userController.getAll);

// Get all unique departments
router.get('/departments', authorize('admin', 'manager'), userController.getDepartments);

// Create employee (admin only)
router.post('/', authorize('admin'), validate(createUserSchema), userController.create);

// Get specific employee
router.get('/:id', authorize('admin', 'manager'), userController.getById);

// Update profile (admin or self)
router.put('/:id', validate(updateUserSchema), userController.update);

// Reset password (admin only)
router.post('/:id/reset-password', authorize('admin'), userController.resetPassword);

// Deactivate employee (admin only)
router.patch('/:id/deactivate', authorize('admin'), userController.deactivate);

// Activate employee (admin only)
router.patch('/:id/activate', authorize('admin'), userController.activate);

// Change role (admin only)
router.patch('/:id/role', authorize('admin'), validate(changeRoleSchema), userController.changeRole);

// Delete employee (admin only)
router.delete('/:id', authorize('admin'), userController.delete);

module.exports = router;
