'use strict';

/**
 * payslip.service.js
 *
 * PDF generation using PDFKit (via pdfGenerator.service).
 * Works reliably on all platforms including Windows.
 */

const ProcessedPayroll = require('./processedPayroll.model');
const pdfGeneratorService = require('../reports/pdfGenerator.service');
const payslipTemplateService = require('./payslipTemplate.service');
const PayslipTemplate = require('./payslipTemplate.model');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate PDF buffer from a payroll ID (used by the download endpoint).
 */
exports.generatePayslipPdf = async (payrollId) => {
    const payroll = await ProcessedPayroll.findById(payrollId).populate('user');
    if (!payroll) throw new Error('Processed Payroll not found');

    const allowedStatuses = ['Completed', 'Paid', 'Processed', 'Warning'];
    if (!allowedStatuses.includes(payroll.status)) {
        throw new Error('Payslip cannot be generated for this record status.');
    }

    const Settings = require('../settings/settings.model');
    const settings = await Settings.findOne();

    // 1. Get the template
    let template;
    if (payroll.payslipTemplateId) {
        template = await PayslipTemplate.findById(payroll.payslipTemplateId);
    }
    if (!template) {
        template = await payslipTemplateService.getDefaultTemplate(payroll.companyId);
    }

    // 2. Determine HTML and Background
    let templateHtml = template.htmlContent;
    if (template.layoutType) {
        templateHtml = payslipTemplateService.getHtmlForLayout(template.layoutType);
    }

    // 3. Render HTML
    const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
    const html = payslipTemplateService.renderTemplate(templateHtml, templateData, template.backgroundImageUrl);

    // 3. Generate PDF from HTML
    return pdfGeneratorService.generatePayslipBuffer(payroll, settings, html);
};

/**
 * Generate PDF buffer directly from a payroll object (used by the email service).
 */
exports.generatePayslipBuffer = async (payroll) => {
    const Settings = require('../settings/settings.model');
    const settings = await Settings.findOne();

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
    const html = payslipTemplateService.renderTemplate(templateHtml, templateData, template.backgroundImageUrl);

    return pdfGeneratorService.generatePayslipBuffer(payroll, settings, html);
};

/**
 * Internal helper for unified HTML generation.
 * (Keeping it for backward compatibility if needed, though we primarily use PDFKit now)
 */
exports._generateHtmlInternal = (payroll, settings) => {
    const { getEnterprisePayslipHtml } = require('./payslip.template');
    return getEnterprisePayslipHtml(payroll, settings);
};
