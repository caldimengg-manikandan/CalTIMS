'use strict';

const express = require('express');
const router = express.Router();
const payrollController = require('./payroll.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission, denyRoles } = require('../../middleware/rbac.middleware');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');

router.use(authenticate);
router.use(checkSubscription);

// ─── Settings & Config ────────────────────────────────────────────────────────
router.get('/config', requireFeature('payroll'), payrollController.getConfig);
router.patch('/config', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.updateConfig);

// ─── Salary Structures (CRUD) ────────────────────────────────────────────────
router.get('/role-structures', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getAllRoleStructures);
router.get('/role-structures/:id', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getStructureById);
router.post('/role-structures', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.createOrUpdateRoleStructure);
router.patch('/role-structures/:id/toggle', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.toggleStructureStatus);
router.delete('/role-structures/:id', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.hardDeleteStructure);

// ─── Employee Profiles ───────────────────────────────────────────────────────
router.get('/profiles', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getAllProfiles);
router.get('/profiles/:userId', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getProfile);
router.get('/profiles/employee/:employeeId', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getProfileByEmployeeId);
router.post('/profiles', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.createOrUpdateProfile);
router.post('/setup-profile', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.setupFullProfile);
router.delete('/profiles/:id', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.deleteProfile);

// ─── Processing ──────────────────────────────────────────────────────────────
router.post('/run', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.runPayrollExecution);
router.post('/process/simulate', requireFeature('payroll'), payrollController.simulatePayroll);
router.post('/process/save', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.savePayroll);
router.post('/process', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.savePayroll);

// Simplified Actions
router.post('/mark-paid', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'disburse'), payrollController.markAsPaid);
router.get('/history', requireFeature('payroll'), checkPermission('Payroll', 'Execution Ledger', 'view'), payrollController.getPayrollHistory);

// ─── Payslips ────────────────────────────────────────────────────────────────
router.post('/payslips/generate', requireFeature('payroll'), checkPermission('Payroll', 'Payslip Generation', 'generate'), payrollController.generatePayslips);
router.get('/payslips/generated', requireFeature('payroll'), checkPermission('Payroll', 'Payslip Generation', 'view'), payrollController.getGeneratedPayslips);
router.post('/payslips/bulk-mark-paid', requireFeature('payroll'), checkPermission('Payroll', 'Payslip Generation', 'generate'), payrollController.bulkMarkPayslipsAsPaid);
router.post('/payslips/:id/mark-paid', requireFeature('payroll'), checkPermission('Payroll', 'Payslip Generation', 'generate'), payrollController.markPayslipAsPaid);
router.get('/payslips/my', requireFeature('payslips'), payrollController.getMyPayslips);
router.get('/payslips/:id', requireFeature('payslips'), payrollController.getPayslip);
router.get('/payslip/:id/download', requireFeature('payslips'), payrollController.downloadPayslipPDF);
router.post('/payslip/:id/send-email', requireFeature('payslips'), payrollController.sendPayslipEmail);
router.post('/payslips/bulk-send-email', requireFeature('payslips'), checkPermission('Payroll', 'Payslip Generation', 'generate'), payrollController.bulkSendPayslipEmails);
router.get('/payslip/:employeeId', requireFeature('payslips'), checkPermission('Payroll', 'Payslip Generation', 'view'), payrollController.getPayslipByUserId); 

// 🚀 ENTERPRISE REDIRECTS (requested format)
router.post('/policy', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.updateConfig);
router.post('/salary-structure', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.createOrUpdateRoleStructure);
router.post('/payroll-profile', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.createOrUpdateProfile);


// ─── Reporting ───────────────────────────────────────────────────────────────
router.get('/reports/summary', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Reports', 'view'), payrollController.getPayrollSummaryReport);
router.get('/reports/department-analysis', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Reports', 'view'), payrollController.getDepartmentAnalysisReport);

// ─── Dashboard & Analytics ──────────────────────────────────────────────────
router.get('/dashboard', requireFeature('payroll'), checkPermission('Payroll', 'Dashboard', 'view'), payrollController.getDashboardData);
router.get('/analytics', requireFeature('payroll'), checkPermission('Payroll', 'Dashboard', 'view'), payrollController.getAnalytics);
router.get('/batches', requireFeature('payroll'), checkPermission('Payroll', 'Execution Ledger', 'view'), payrollController.getPayrollBatchHistory);


// ─── Verification & Readiness ────────────────────────────────────────────────
router.get('/readiness', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getReadinessCheck);
router.get('/preview', requireFeature('payroll'), checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getPreview);

module.exports = router;
