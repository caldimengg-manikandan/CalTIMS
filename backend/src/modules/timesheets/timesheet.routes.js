'use strict';

const express = require('express');
const router = express.Router();
const timesheetController = require('./timesheet.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

router.use(authenticate);

// Dashboard summary for timesheets
router.get('/summary', timesheetController.getDashboardSummary);
router.get('/history', timesheetController.getHistory);
router.get('/admin-summary', authorize('admin', 'manager'), timesheetController.getAdminSummary);
router.get('/admin-list', authorize('admin', 'manager'), timesheetController.getAdminTimesheets);
router.get('/admin-filters', authorize('admin', 'manager'), timesheetController.getAdminFilterOptions);
router.get('/admin-kpi', authorize('admin', 'manager'), timesheetController.getAdminKpiSummary);

// CRUD
router.post('/bulk', timesheetController.bulkUpsert);
router.post('/bulk-submit', timesheetController.bulkSubmit);
router.post('/', timesheetController.create);
router.get('/', timesheetController.getAll);
router.get('/:id', timesheetController.getById);
router.put('/:id', timesheetController.update);
router.delete('/:id', timesheetController.delete);

// Workflow
router.patch('/:id/submit', timesheetController.submit);
router.patch('/:id/approve', authorize('admin', 'manager'), timesheetController.approve);
router.patch('/:id/reject', authorize('admin', 'manager'), timesheetController.reject);

module.exports = router;
