'use strict';

/**
 * payslip.service.js
 *
 * PDF generation using PDFKit (via pdfGenerator.service).
 * Works reliably on all platforms including Windows.
 * Updated to use Prisma for strict snapshot-based data retrieval.
 */

const { prisma } = require('../../config/database');
const pdfGeneratorService = require('../reports/pdfGenerator.service');
const payslipTemplateService = require('./payslipTemplate.service');

/**
 * Generate PDF buffer from a payroll ID (used by the download endpoint).
 */
exports.generatePayslipPdf = async (payrollId, organizationId) => {
    // 1. Fetch Processed Payroll strictly from the database
    const payroll = await prisma.processedPayroll.findFirst({
        where: { id: payrollId, organizationId }
    });
    
    if (!payroll) throw new Error('Processed Payroll not found');

    // 2. Fetch Settings and Organization Info
    const [orgSettings, organization] = await Promise.all([
        prisma.orgSettings.findUnique({ where: { organizationId } }),
        prisma.organization.findUnique({ where: { id: organizationId } })
    ]);
    
    const settings = orgSettings?.data || {};
    if (!settings.organization) settings.organization = {};
    
    // Fallback to Organization model data if settings are empty
    settings.organization.companyName = settings.organization.companyName || organization?.name || 'CALTIMS';
    settings.organization.address = settings.organization.address || organization?.address || '';

    // 3. Get the template
    let template;
    if (payroll.payslipTemplateId) {
        template = await prisma.payslipTemplate.findUnique({
            where: { id: payroll.payslipTemplateId }
        });
    }
    
    if (!template) {
        template = await payslipTemplateService.getDefaultTemplate(organizationId);
    }

    // 4. Determine HTML
    let templateHtml = template.htmlContent;
    if (template.layoutType && !templateHtml) {
        templateHtml = payslipTemplateService.getHtmlForLayout(template.layoutType);
    }

    // 5. Render HTML using snapshots stored in ProcessedPayroll
    const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
    const html = payslipTemplateService.renderTemplate(templateHtml, templateData, template.backgroundImageUrl);

    // 6. Generate PDF from HTML
    return pdfGeneratorService.generatePayslipBuffer(payroll, settings, html);
};

/**
 * Generate PDF buffer directly from a payroll object (used by the email service).
 */
exports.generatePayslipBuffer = async (payroll, organizationId) => {
    const [orgSettings, organization] = await Promise.all([
        prisma.orgSettings.findUnique({ where: { organizationId } }),
        prisma.organization.findUnique({ where: { id: organizationId } })
    ]);
    
    const settings = orgSettings?.data || {};
    if (!settings.organization) settings.organization = {};
    settings.organization.companyName = settings.organization.companyName || organization?.name || 'CALTIMS';
    settings.organization.address = settings.organization.address || organization?.address || '';

    let template;
    if (payroll.payslipTemplateId) {
        template = await prisma.payslipTemplate.findUnique({
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

    const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
    const html = payslipTemplateService.renderTemplate(templateHtml, templateData, template.backgroundImageUrl);

    return pdfGeneratorService.generatePayslipBuffer(payroll, settings, html);
};
