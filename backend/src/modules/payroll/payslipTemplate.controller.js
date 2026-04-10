'use strict';

const { prisma } = require('../../config/database');
const payslipTemplateService = require('./payslipTemplate.service');
const { AppError } = require('../../shared/utils/AppError');
const asyncHandler = require('../../shared/utils/asyncHandler');

exports.getAllTemplates = asyncHandler(async (req, res, next) => {
  const templates = await prisma.payslipTemplate.findMany({
    where: {
      OR: [
        { organizationId: req.organizationId },
        { organizationId: null }
      ]
    },
    orderBy: { name: 'asc' }
  });
  
  res.status(200).json({ status: 'success', data: { templates } });
});

exports.getTemplate = asyncHandler(async (req, res, next) => {
  const template = await prisma.payslipTemplate.findFirst({
    where: { id: req.params.id, 
             OR: [{ organizationId: req.organizationId }, { organizationId: null }] }
  });
  if (!template) throw new AppError('Template not found', 404);
  
  res.status(200).json({ status: 'success', data: { template } });
});

exports.createTemplate = asyncHandler(async (req, res, next) => {
  const { name, htmlContent, layoutType, backgroundImageUrl, isDefault } = req.body;
  const organizationId = req.organizationId;

  if (!organizationId) throw new AppError('Organization context missing', 401);

  if (isDefault) {
    // Unset other defaults for this org
    await prisma.payslipTemplate.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const template = await prisma.payslipTemplate.create({
    data: {
      name,
      htmlContent,
      layoutType,
      backgroundImageUrl,
      isDefault: !!isDefault,
      organizationId,
    }
  });

  // If marked as default, also update OrgSettings for quick lookup
  if (isDefault) {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
    const currentData = orgSettings?.data || {};
    await prisma.orgSettings.update({
      where: { organizationId },
      data: { data: { ...currentData, payroll: { ...(currentData.payroll || {}), activeTemplateId: template.id } } }
    });
  }
  
  res.status(201).json({ status: 'success', data: { template } });
});

exports.updateTemplate = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isDefault, ...updateData } = req.body;
  const organizationId = req.organizationId;

  if (isDefault) {
    await prisma.payslipTemplate.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false }
    });
  }

  const template = await prisma.payslipTemplate.update({
    where: { id },
    data: { ...updateData, isDefault: !!isDefault }
  });

  if (isDefault) {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
    const currentData = orgSettings?.data || {};
    await prisma.orgSettings.update({
      where: { organizationId },
      data: { data: { ...currentData, payroll: { ...(currentData.payroll || {}), activeTemplateId: template.id } } }
    });
  }
  
  res.status(200).json({ status: 'success', data: { template } });
});

exports.deleteTemplate = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const template = await prisma.payslipTemplate.findFirst({ 
    where: { id, organizationId: req.organizationId } 
  });
  
  if (!template) throw new AppError('Template not found or unauthorized', 404);
  
  await prisma.payslipTemplate.delete({ where: { id } });
  res.status(204).json({ status: 'success', data: null });
});

exports.setDefaultTemplate = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const organizationId = req.organizationId;

  await prisma.payslipTemplate.updateMany({
    where: { organizationId, isDefault: true },
    data: { isDefault: false }
  });

  const template = await prisma.payslipTemplate.update({
    where: { id },
    data: { isDefault: true }
  });

  const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const currentData = orgSettings?.data || {};
  await prisma.orgSettings.update({
    where: { organizationId },
    data: { data: { ...currentData, payroll: { ...(currentData.payroll || {}), activeTemplateId: template.id } } }
  });
  
  res.status(200).json({ status: 'success', data: { template } });
});

exports.previewTemplate = asyncHandler(async (req, res, next) => {
  const { htmlContent, layoutType, backgroundImageUrl } = req.body;
  
  let finalHtml = htmlContent;
  if (layoutType && !htmlContent) {
    finalHtml = payslipTemplateService.getHtmlForLayout(layoutType);
  }
  
  const mockPayroll = {
    employeeInfo: { name: 'John Doe', employeeId: 'EMP001', department: 'Engineering', designation: 'Senior Architect' },
    bankDetails: { bankName: 'Global Bank', accountNumber: 'x1234567890', pan: 'ABCDE1234F' },
    attendance: { lopDays: 1 },
    month: 4,
    year: 2026,
    breakdown: {
      earnings: {
        components: [
          { name: 'Basic Salary', value: 50000 },
          { name: 'HRA', value: 20000 }
        ],
        grossEarnings: 70000
      },
      deductions: {
        components: [
          { name: 'EPF', value: 1800 }
        ],
        totalDeductions: 1800
      },
      netPay: 68200
    }
  };

  const templateData = payslipTemplateService.prepareDataForTemplate(mockPayroll);
  const renderedHtml = payslipTemplateService.renderTemplate(finalHtml, templateData, backgroundImageUrl);
  
  res.status(200).json({ status: 'success', data: { html: renderedHtml } });
});

exports.getRenderedPayslip = asyncHandler(async (req, res, next) => {
  const { payrollId } = req.params;
  const organizationId = req.organizationId;

  // 1. Try to find in the new Payslip model first (standard for generated statements)
  let payroll = await prisma.payslip.findFirst({
    where: { id: payrollId, organizationId }
  });
  
  // 2. Fallback to ProcessedPayroll for backward compatibility or pre-generation views
  if (!payroll) {
    payroll = await prisma.processedPayroll.findFirst({
      where: { id: payrollId, organizationId }
    });
  }
  
  if (!payroll) throw new AppError('Payroll record not found', 404);
  
  const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const settings = orgSettings?.data || {};
  
  let template;
  if (payroll.payslipTemplateId) {
    template = await prisma.payslipTemplate.findFirst({ 
      where: { id: payroll.payslipTemplateId }
    });
  }
  
  if (!template) {
    template = await payslipTemplateService.getDefaultTemplate(organizationId);
  }

  let templateHtml = template.htmlContent;
  if (template.layoutType && !templateHtml) {
    templateHtml = payslipTemplateService.getHtmlForLayout(template.layoutType);
  }

  // Use snapshots or breakdown stored in the record
  const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
  const renderedHtml = payslipTemplateService.renderTemplate(templateHtml, templateData, template.backgroundImageUrl);
  
  res.status(200).json({ status: 'success', data: { html: renderedHtml } });
});

exports.getActiveDesign = asyncHandler(async (req, res, next) => {
  const organizationId = req.organizationId;
  const template = await payslipTemplateService.getDefaultTemplate(organizationId);

  res.status(200).json({
    status: 'success',
    data: {
      templateId: template.layoutType || 'CORPORATE',
      backgroundImageUrl: template.backgroundImageUrl || null,
      templateName: template.name
    }
  });
});

exports.uploadBackground = asyncHandler(async (req, res, next) => {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const backgroundUrl = `/uploads/branding/${req.file.filename}`;
  res.status(200).json({ status: 'success', data: { url: backgroundUrl } });
});
