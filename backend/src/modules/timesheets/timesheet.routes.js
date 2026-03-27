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
router.get('/admin-summary', checkPermission('viewReports'), timesheetController.getAdminSummary);
router.get('/admin-list', checkPermission('viewReports'), timesheetController.getAdminTimesheets);
router.get('/admin-filters', checkPermission('viewReports'), timesheetController.getAdminFilterOptions);
router.get('/admin-kpi', checkPermission('viewReports'), timesheetController.getAdminKpiSummary);

// CRUD
router.get('/compliance', checkPermission('viewReports'), requireFeature('reports'), timesheetController.getCompliance);
router.post('/bulk', timesheetController.bulkUpsert);
router.post('/bulk-submit', timesheetController.bulkSubmit);
router.post('/admin-fill', checkPermission('manageEmployees'), requireFeature('timesheet'), timesheetController.adminFill);
router.post('/', timesheetController.create);
router.get('/', timesheetController.getAll);
router.get('/:id', timesheetController.getById);
router.put('/:id', timesheetController.update);
router.delete('/:id', timesheetController.delete);

// Workflow
router.patch('/:id/submit', timesheetController.submit);
router.patch('/:id/approve', checkPermission('approveTimesheets'), timesheetController.approve);
router.patch('/:id/reject', checkPermission('approveTimesheets'), timesheetController.reject);

module.exports = router;
