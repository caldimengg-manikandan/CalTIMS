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

router.use(authorize('admin', 'hr'));

router.post('/upload-background', upload.single('background'), payslipTemplateController.uploadBackground);
router.post('/', payslipTemplateController.createTemplate);
router.patch('/:id', payslipTemplateController.updateTemplate);
router.delete('/:id', payslipTemplateController.deleteTemplate);
router.post('/:id/set-default', payslipTemplateController.setDefaultTemplate);
router.post('/preview', payslipTemplateController.previewTemplate);
router.get('/render/:payrollId', payslipTemplateController.getRenderedPayslip);

module.exports = router;
