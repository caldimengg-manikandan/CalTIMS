'use strict';

const PayslipTemplate = require('./payslipTemplate.model');
const PayslipDesign = require('./payslipDesign.model');
const payslipTemplateService = require('./payslipTemplate.service');
const AppError = require('../../shared/utils/AppError');
const asyncHandler = require('../../shared/utils/asyncHandler');

exports.getAllTemplates = asyncHandler(async (req, res, next) => {
  const templates = await PayslipTemplate.find({ 
    $or: [{ companyId: req.user.companyId }, { type: 'DEFAULT' }],
    isActive: true 
  }).sort({ type: 1, name: 1 });
  
  res.status(200).json({ status: 'success', data: { templates } });
});

exports.getTemplate = asyncHandler(async (req, res, next) => {
  const template = await PayslipTemplate.findById(req.params.id);
  if (!template) throw new AppError('Template not found', 404);
  
  res.status(200).json({ status: 'success', data: { template } });
});

exports.createTemplate = asyncHandler(async (req, res, next) => {
  const { templateId, backgroundImageUrl, isDesignOnly } = req.body;
  const companyId = req.user.companyId;

  if (!companyId) {
    return next(new AppError('Unauthorized: Company context missing from session. Please re-login.', 401));
  }

  // Single Active Design Rule: Only one design is active per company
  await PayslipDesign.updateMany(
    { companyId },
    { isActive: false }
  );

  const design = await PayslipDesign.create({
    companyId,
    templateId: templateId || req.body.layoutType || 'CORPORATE',
    backgroundImageUrl: backgroundImageUrl || req.body.backgroundImageUrl,
    isActive: true,
    createdBy: req.user.id
  });

  // Also create a template record for history if not just a design update
  let template;
  if (!isDesignOnly) {
    template = await PayslipTemplate.create({
      ...req.body,
      type: 'CUSTOM',
      createdBy: req.user.id,
      companyId,
      isSystemDefault: true // Make this the new default
    });
  }
  
  res.status(201).json({ 
    status: 'success', 
    data: { 
      design,
      template
    } 
  });
});

exports.updateTemplate = asyncHandler(async (req, res, next) => {
  const template = await PayslipTemplate.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!template) throw new AppError('Template not found or unauthorized', 404);
  
  res.status(200).json({ status: 'success', data: { template } });
});

exports.deleteTemplate = asyncHandler(async (req, res, next) => {
  const template = await PayslipTemplate.findOne({ 
    _id: req.params.id, 
    companyId: req.user.companyId 
  });
  
  if (!template) throw new AppError('Template not found or unauthorized', 404);
  
  if (template.type === 'DEFAULT') {
    throw new AppError('Default templates cannot be deleted', 400);
  }
  
  await template.deleteOne();
  res.status(204).json({ status: 'success', data: null });
});

exports.setDefaultTemplate = asyncHandler(async (req, res, next) => {
  const template = await PayslipTemplate.findById(req.params.id);
  if (!template) throw new AppError('Template not found', 404);
  
  template.isSystemDefault = true;
  await template.save();
  
  res.status(200).json({ status: 'success', data: { template } });
});

exports.previewTemplate = asyncHandler(async (req, res, next) => {
  const { htmlContent, layoutType, backgroundImageUrl } = req.body;
  
  let finalHtml = htmlContent;
  if (layoutType) {
    finalHtml = payslipTemplateService.getHtmlForLayout(layoutType);
  }
  
  // Create mock data
  const mockPayroll = {
    employeeInfo: { name: 'John Doe', employeeId: 'EMP001', department: 'Engineering', designation: 'Senior Architect' },
    bankDetails: { bankName: 'Global Bank', accountNumber: '1234567890', pan: 'ABCDE1234F' },
    attendance: { lopDays: 1 },
    month: 3,
    year: 2026,
    breakdown: {
      earnings: {
        components: [
          { name: 'Basic Salary', value: 50000 },
          { name: 'HRA', value: 20000 },
          { name: 'Special Allowance', value: 10000 }
        ],
        grossEarnings: 80000
      },
      deductions: {
        components: [
          { name: 'EPF', value: 1800 },
          { name: 'Professional Tax', value: 200 }
        ],
        totalDeductions: 2000
      },
      netPay: 78000,
      lopDeduction: 2500
    }
  };

  const templateData = payslipTemplateService.prepareDataForTemplate(mockPayroll);
  const renderedHtml = payslipTemplateService.renderTemplate(finalHtml, templateData, backgroundImageUrl);
  
  res.status(200).json({ status: 'success', data: { html: renderedHtml } });
});

exports.getRenderedPayslip = asyncHandler(async (req, res, next) => {
  const ProcessedPayroll = require('./processedPayroll.model');
  const Settings = require('../settings/settings.model');
  
  const payroll = await ProcessedPayroll.findOne({
    _id: req.params.payrollId,
    companyId: req.user.companyId
  }).populate('user');
  if (!payroll) throw new AppError('Payroll record not found or unauthorized', 404);
  
  const settings = await Settings.findOne({ companyId: req.user.companyId });
  
  let template;
  if (payroll.payslipTemplateId) {
    template = await PayslipTemplate.findById(payroll.payslipTemplateId);
  }
  if (!template) {
    template = await payslipTemplateService.getDefaultTemplate(payroll.companyId);
  }

  let templateHtml = template.htmlContent;
  if (template.layoutType) {
    templateHtml = payslipTemplateService.getHtmlForLayout(template.layoutType);
  }

  const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
  const renderedHtml = payslipTemplateService.renderTemplate(templateHtml, templateData, template.backgroundImageUrl);
  
  res.status(200).json({ status: 'success', data: { html: renderedHtml } });
});

exports.getActiveDesign = asyncHandler(async (req, res, next) => {
  const design = await PayslipDesign.findOne({ 
    companyId: req.user.companyId,
    isActive: true 
  }).sort({ createdAt: -1 });

  if (!design) {
    // Fallback to default
    return res.status(200).json({
      status: 'success',
      data: {
        templateId: 'CORPORATE',
        backgroundImageUrl: null
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      templateId: design.templateId,
      backgroundImageUrl: design.backgroundImageUrl
    }
  });
});

exports.uploadBackground = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  // Construct the URL for the uploaded file
  const backgroundUrl = `/uploads/branding/${req.file.filename}`;
  
  res.status(200).json({
    status: 'success',
    data: { url: backgroundUrl }
  });
});
