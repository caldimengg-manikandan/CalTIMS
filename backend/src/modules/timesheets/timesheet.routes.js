'use strict';

const express = require('express');
const router = express.Router();
const timesheetController = require('./timesheet.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');

router.use(authenticate);
router.use(checkSubscription);

// Dashboard summary for timesheets
router.get('/summary', timesheetController.getDashboardSummary);
router.get('/history', timesheetController.getHistory);
router.get('/admin-summary', checkPermission('Timesheets', 'Dashboard', 'view'), timesheetController.getDashboardSummary);
router.get('/admin-list', checkPermission('Timesheets', 'Management', 'view'), timesheetController.getAdminTimesheets);
router.get('/admin-filters', checkPermission('Timesheets', 'Management', 'view'), timesheetController.getAdminFilterOptions);
router.get('/admin-kpi', checkPermission('Timesheets', 'Dashboard', 'view'), timesheetController.getAdminKpiSummary);

// CRUD
router.get('/compliance', checkPermission('Timesheets', 'Dashboard', 'view'), requireFeature('audit_logs'), timesheetController.getCompliance);
router.post('/bulk', timesheetController.bulkUpsert);
router.post('/bulk-submit', timesheetController.bulkSubmit);
router.post('/admin-fill', checkPermission('Employees', 'Employee List', 'edit'), requireFeature('timesheets'), timesheetController.adminFill);
router.post('/', timesheetController.create);
router.get('/', timesheetController.getAll);
router.get('/:id', timesheetController.getById);
router.put('/:id', timesheetController.update);
router.delete('/:id', timesheetController.delete);

// Workflow
router.patch('/:id/submit', timesheetController.submit);
router.patch('/:id/approve', checkPermission('Timesheets', 'Management', 'approve'), timesheetController.approve);
router.patch('/:id/reject', checkPermission('Timesheets', 'Management', 'reject'), timesheetController.reject);

module.exports = router;
