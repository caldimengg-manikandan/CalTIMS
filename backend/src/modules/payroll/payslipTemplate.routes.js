'use strict';

const express = require('express');
const router = express.Router();
const payslipTemplateController = require('./payslipTemplate.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

const upload = require('../../middleware/upload.middleware');

router.use(authenticate);

router.get('/', payslipTemplateController.getAllTemplates);
router.get('/active', payslipTemplateController.getActiveDesign);
router.get('/:id', payslipTemplateController.getTemplate);
router.get('/render/:payrollId', payslipTemplateController.getRenderedPayslip);

router.use(authorize('admin', 'hr'));

module.exports = router;
