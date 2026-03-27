'use strict';

const express = require('express');
const router = express.Router();
const payrollController = require('./payroll.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');

router.use(authenticate);

// ─── Settings & Config ────────────────────────────────────────────────────────
router.get('/config', payrollController.getConfig);
router.patch('/config', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.updateConfig);

// ─── Salary Structures (CRUD) ────────────────────────────────────────────────
router.get('/role-structures', checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getAllRoleStructures);
router.get('/role-structures/:id', checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getStructureById);
router.post('/role-structures', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.createOrUpdateRoleStructure);
router.patch('/role-structures/:id/toggle', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.toggleStructureStatus);
router.delete('/role-structures/:id', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.hardDeleteStructure);

// ─── Employee Profiles ───────────────────────────────────────────────────────
router.get('/profiles', checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getAllProfiles);
router.get('/profiles/:userId', checkPermission('Payroll', 'Payroll Engine', 'view'), payrollController.getProfile);
router.post('/profiles', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.createOrUpdateProfile);
router.delete('/profiles/:id', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.deleteProfile);

// ─── Processing ──────────────────────────────────────────────────────────────
router.post('/run', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.runPayrollExecution);
router.post('/process/simulate', authenticate, payrollController.simulatePayroll);
router.post('/process/save', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.savePayroll);
router.post('/process', checkPermission('Payroll', 'Payroll Engine', 'run'), payrollController.savePayroll);

// Approval Workflow
router.post('/submit-approval', checkPermission('Payroll', 'Payroll Engine', 'submit'), payrollController.submitForApproval);
router.post('/approve', checkPermission('Payroll', 'Payroll Engine', 'approve'), payrollController.approvePayroll);
router.post('/reopen', checkPermission('Payroll', 'Payroll Engine', 'approve'), payrollController.reopenPayroll);
router.post('/mark-paid', checkPermission('Payroll', 'Payroll Engine', 'disburse'), payrollController.markAsPaid);
router.post('/hard-lock', checkPermission('Payroll', 'Payroll Engine', 'approve'), payrollController.hardLock);
router.get('/history', checkPermission('Payroll', 'Execution Ledger', 'view'), payrollController.getPayrollHistory);

// ─── Payslips ────────────────────────────────────────────────────────────────
router.get('/payslips/my', payrollController.getMyPayslips);
router.get('/payslips/:id', payrollController.getPayslip);
router.get('/payslip/:id/download', payrollController.downloadPayslipPDF);
router.post('/payslip/:id/send-email', checkPermission('Payroll', 'Payslip Generation', 'generate'), payrollController.sendPayslipEmail);
router.post('/payslips/bulk-send-email', checkPermission('Payroll', 'Payslip Generation', 'generate'), payrollController.bulkSendPayslipEmails);
router.get('/payslip/:employeeId', checkPermission('Payroll', 'Payslip Generation', 'view'), payrollController.getPayslipByUserId); 

// 🚀 ENTERPRISE REDIRECTS (requested format)
router.post('/policy', authorize('admin', 'finance'), payrollController.updateConfig);
router.post('/salary-structure', authorize('admin', 'finance'), payrollController.createOrUpdateRoleStructure);
router.post('/payroll-profile', authorize('admin', 'finance'), payrollController.createOrUpdateProfile);


// ─── Reporting ───────────────────────────────────────────────────────────────
router.get('/reports/summary', checkPermission('Payroll', 'Payroll Reports', 'view'), payrollController.getPayrollSummaryReport);
router.get('/reports/department-analysis', checkPermission('Payroll', 'Payroll Reports', 'view'), payrollController.getDepartmentAnalysisReport);

// ─── Dashboard & Analytics ──────────────────────────────────────────────────
router.get('/dashboard', checkPermission('Payroll', 'Dashboard', 'view'), payrollController.getDashboardData);
router.get('/analytics', checkPermission('Payroll', 'Dashboard', 'view'), payrollController.getAnalytics);
router.get('/batches', checkPermission('Payroll', 'Execution Ledger', 'view'), payrollController.getPayrollBatchHistory);

module.exports = router;
