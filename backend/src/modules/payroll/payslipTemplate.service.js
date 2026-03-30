'use strict';

const PayslipTemplate = require('./payslipTemplate.model');
const PayslipDesign = require('./payslipDesign.model');
const { DEFAULT_TEMPLATES } = require('./defaultTemplates');
const logger = require('../../shared/utils/logger');

/**
 * Seed default templates if they don't exist
 * Note: These are system-wide defaults. In a multi-tenant setup,
 * you might want to clone these for each new organization.
 */
exports.seedTemplates = async (organizationId) => {
  try {
    if (!organizationId) {
      logger.warn('seedTemplates called without organizationId');
      return;
    }
    for (const template of DEFAULT_TEMPLATES) {
      await PayslipTemplate.findOneAndUpdate(
        { name: template.name, organizationId },
        { ...template, type: 'DEFAULT', organizationId },
        { upsert: true, new: true }
      );
    }
    logger.info(`Default payslip templates seeded for org: ${organizationId}`);
  } catch (err) {
    logger.error('Error seeding payslip templates:', err);
  }
};

/**
 * Get the active default template for an organization
 */
exports.getDefaultTemplate = async (organizationId = null) => {
  // 1. Try to find the active design for the organization
  if (organizationId) {
    const activeDesign = await PayslipDesign.findOne({ organizationId, isActive: true }).sort({ createdAt: -1 });
    if (activeDesign) {
      // Return a mock template object with the design properties
      return {
        layoutType: activeDesign.templateId,
        backgroundImageUrl: activeDesign.backgroundImageUrl,
        htmlContent: exports.getHtmlForLayout(activeDesign.templateId),
        name: `Active Design (${activeDesign.templateId})`
      };
    }
  }

  // 2. Fallback to templates marked as default for this organization
  let template = await PayslipTemplate.findOne({ organizationId, isActive: true, isSystemDefault: true });
  
  if (!template && organizationId) {
    // 3. Last fallback: any active template for this organization
    template = await PayslipTemplate.findOne({ organizationId, isActive: true });
  }

  // 4. Global system fallback (if still null)
  if (!template) {
    template = await PayslipTemplate.findOne({ type: 'DEFAULT', isSystemDefault: true });
  }
  
  return template;
};

/**
 * Get HTML content for a specific layout type
 */
exports.getHtmlForLayout = (layoutType) => {
  const template = DEFAULT_TEMPLATES.find(t => t.name === layoutType);
  return template ? template.htmlContent : DEFAULT_TEMPLATES[0].htmlContent;
};

/**
 * Template Engine: Replace placeholders with real data
 */
exports.renderTemplate = (templateHtml, data, backgroundImageUrl = null) => {
  let rendered = templateHtml;

  // 1. Inject background image if provided
  if (backgroundImageUrl) {
    const bgStyle = `
      <style>
        body {
          background-image: url('${backgroundImageUrl}') !important;
          background-size: cover !important;
          background-attachment: fixed !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
        }
        .container, .card, .payslip-container {
          background-color: transparent !important;
          backdrop-filter: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      </style>
    `;
    if (rendered.includes('</head>')) {
      rendered = rendered.replace('</head>', `${bgStyle}</head>`);
    } else {
      rendered = bgStyle + rendered;
    }
  }

  // 2. Handle basic placeholders
  const placeholders = {
    employeeName: data.employeeName || 'N/A',
    employeeId: data.employeeId || 'N/A',
    department: data.department || 'N/A',
    designation: data.designation || 'N/A',
    bankName: data.bankName || 'N/A',
    accountNo: data.accountNo || 'N/A',
    panId: data.panId || 'N/A',
    grossEarnings: data.grossEarnings || '0.00',
    totalDeductions: data.totalDeductions || '0.00',
    netPay: data.netPay || '0.00',
    lopDays: data.lopDays || '0',
    overtimeHours: data.overtimeHours || '0',
    refNo: data.refNo || 'N/A',
    monthName: data.monthName || '',
    year: data.year || '',
    date: new Date().toLocaleDateString()
  };

  Object.entries(placeholders).forEach(([key, value]) => {
    rendered = rendered.split(`{{${key}}}`).join(value);
  });

  // 3. Handle list placeholders (Table/Row versions)
  // For earningsTable
  if (rendered.includes('{{earningsTable}}')) {
    const tableHtml = Object.entries(data.earnings || {})
      .map(([name, val]) => `<tr><td>${name}</td><td align="right">${val}</td></tr>`)
      .join('');
    rendered = rendered.split('{{earningsTable}}').join(`<table style="width:100%">${tableHtml}</table>`);
  }

  if (rendered.includes('{{earningsRows}}')) {
    const rowsHtml = Object.entries(data.earnings || {})
      .map(([name, val]) => `<tr><td>${name}</td><td align="right">${val}</td></tr>`)
      .join('');
    rendered = rendered.split('{{earningsRows}}').join(rowsHtml);
  }

  // For deductionsTable
  if (rendered.includes('{{deductionsTable}}')) {
    const tableHtml = Object.entries(data.deductions || {})
      .map(([name, val]) => `<tr><td>${name}</td><td align="right">${val}</td></tr>`)
      .join('');
    rendered = rendered.split('{{deductionsTable}}').join(`<table style="width:100%">${tableHtml}</table>`);
  }

  if (rendered.includes('{{deductionsRows}}')) {
    const rowsHtml = Object.entries(data.deductions || {})
      .map(([name, val]) => `<tr><td>${name}</td><td align="right">-${val}</td></tr>`)
      .join('');
    rendered = rendered.split('{{deductionsRows}}').join(rowsHtml);
  }

  return rendered;
};

/**
 * Format payroll data for the engine
 */
exports.prepareDataForTemplate = (payroll, settings = {}) => {
  const user = payroll.user || {};
  const breakdown = payroll.breakdown || {};
  const currencySymbol = settings?.payroll?.currencySymbol || '₹';
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const format = (val) => `${currencySymbol}${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const earnings = {};
  (breakdown.earnings?.components || []).forEach(e => earnings[e.name] = format(e.value));

  const deductions = {};
  (breakdown.deductions?.components || []).forEach(d => deductions[d.name] = format(d.value));
  if (breakdown.lopDeduction > 0) deductions['LOP Deduction'] = format(breakdown.lopDeduction);

  return {
    employeeName: payroll.employeeInfo?.name || user.name,
    employeeId: payroll.employeeInfo?.employeeId || user.employeeId,
    department: payroll.employeeInfo?.department || user.department,
    designation: payroll.employeeInfo?.designation || user.designation,
    bankName: payroll.bankDetails?.bankName || user.bankName,
    accountNo: payroll.bankDetails?.accountNumber || user.accountNumber,
    panId: payroll.bankDetails?.pan || user.pan,
    grossEarnings: format(breakdown.earnings?.grossEarnings),
    totalDeductions: format(breakdown.deductions?.totalDeductions),
    netPay: format(breakdown.netPay),
    lopDays: payroll.attendance?.lopDays || 0,
    overtimeHours: payroll.overtimeHours || 0,
    refNo: (payroll._id || '').toString().slice(-8).toUpperCase(),
    monthName: monthNames[(payroll.month || 1) - 1],
    year: payroll.year,
    earnings,
    deductions
  };
};
