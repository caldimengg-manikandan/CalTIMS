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
router.get('/', checkPermission('Employees', 'Employee List', 'view'), userController.getAll);

// Get all unique departments
router.get('/departments', checkPermission('Employees', 'Employee List', 'view'), userController.getDepartments);

// Get all roles
router.get('/roles', checkPermission('Employees', 'Employee List', 'view'), userController.getRoles);

// Create employee (admin/manager/HR)
router.post('/', checkPermission('Employees', 'Employee List', 'create'), validate(createUserSchema), userController.create);

// Get specific employee
router.get('/:id', checkPermission('Employees', 'Employee List', 'view'), userController.getById);

// Update profile (admin or self)
router.put('/:id', validate(updateUserSchema), userController.update);

// Reset password (admin/manager/HR)
router.post('/:id/reset-password', checkPermission('Employees', 'Employee List', 'edit'), userController.resetPassword);

// Deactivate employee (admin/manager/HR)
router.patch('/:id/deactivate', checkPermission('Employees', 'Employee List', 'edit'), userController.deactivate);

// Activate employee (admin/manager/HR)
router.patch('/:id/activate', checkPermission('Employees', 'Employee List', 'edit'), userController.activate);

// Change role (admin/manager/HR)
router.patch('/:id/role', checkPermission('Employees', 'Employee List', 'edit'), validate(changeRoleSchema), userController.changeRole);

// Delete employee (destructive action)
router.delete('/:id', checkPermission('Employees', 'Employee List', 'delete'), userController.delete);

module.exports = router;
