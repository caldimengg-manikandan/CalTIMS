'use strict';

const { prisma } = require('../../config/database');
const { DEFAULT_TEMPLATES } = require('./defaultTemplates');
const logger = require('../../shared/utils/logger');
const { decryptJson } = require('../../shared/utils/security');

const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const format = (n, suffix) => {
        if (n === 0) return '';
        if (n > 19) return b[Math.floor(n / 10)] + ' ' + a[n % 10] + suffix;
        return a[n] + suffix;
    };
    let str = '';
    str += format(Math.floor(num / 10000000), 'Crore ');
    str += format(Math.floor((num / 100000) % 100), 'Lakh ');
    str += format(Math.floor((num / 1000) % 100), 'Thousand ');
    str += format(Math.floor((num / 100) % 10), 'Hundred ');
    let lastTwo = Math.floor(num % 100);
    if (lastTwo > 0) {
        if (str !== '') str += 'and ';
        if (lastTwo > 19) str += b[Math.floor(lastTwo / 10)] + ' ' + a[lastTwo % 10];
        else str += a[lastTwo];
    }
    return str.trim() + ' Rupees Only';
};

/**
 * Seed default templates if they don't exist
 */
exports.seedTemplates = async (organizationId) => {
  try {
    if (!organizationId) {
      logger.warn('seedTemplates called without organizationId');
      return;
    }
    for (const template of DEFAULT_TEMPLATES) {
      await prisma.payslipTemplate.upsert({
        where: { id: `default-${template.name.toLowerCase()}` }, // Stable ID for defaults
        update: { ...template, organizationId },
        create: { id: `default-${template.name.toLowerCase()}`, ...template, organizationId }
      });
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
  // 1. Try to find the active design in OrgSettings
  if (organizationId) {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
    const payrollConfig = orgSettings?.data?.payroll || {};
    
    if (payrollConfig.activeTemplateId) {
      const template = await prisma.payslipTemplate.findUnique({
        where: { id: payrollConfig.activeTemplateId }
      });
      if (template) return template;
    }
  }

  // 2. Fallback to templates marked as default for this organization
  let template = await prisma.payslipTemplate.findFirst({
    where: { organizationId, isDefault: true }
  });
  
  if (!template && organizationId) {
    // 3. Last fallback: any template for this organization
    template = await prisma.payslipTemplate.findFirst({
      where: { organizationId }
    });
  }

  // 4. Global system fallback
  if (!template) {
    template = await prisma.payslipTemplate.findFirst({
      where: { organizationId: null, isDefault: true }
    });
  }
  
  return template || DEFAULT_TEMPLATES[0]; // Hard fallback
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
  let rendered = templateHtml || '';

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
          background-color: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(5px) !important;
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
    joiningDate: data.joiningDate || 'N/A',
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
    companyName: data.companyName || 'TIMS',
    companyAddress: data.companyAddress || '',
    amountInWords: data.amountInWords || '',
    standardWorkingDays: data.standardWorkingDays || '0',
    individualWorkingDays: data.individualWorkingDays || '0',
    payableDays: data.payableDays || '0',
    date: new Date().toLocaleDateString()
  };

  Object.entries(placeholders).forEach(([key, value]) => {
    rendered = rendered.split(`{{${key}}}`).join(value);
  });

  // 3. Handle list placeholders
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

  if (rendered.includes('{{earningsDeductionsRows}}')) {
      const earnings = Object.entries(data.earnings || {});
      const deductions = Object.entries(data.deductions || {});
      const maxRows = Math.max(earnings.length, deductions.length);
      let rowsHtml = '';
      for (let i = 0; i < maxRows; i++) {
          const e = earnings[i] || ['', ''];
          const d = deductions[i] || ['', ''];
          rowsHtml += `
            <tr>
                <td class="td-name">${e[0]}</td>
                <td class="td-val val-blue">${e[1]}</td>
                <td class="td-name">${d[0]}</td>
                <td class="td-val deduction-val">${d[1] ? '-' + d[1] : ''}</td>
            </tr>
          `;
      }
      rendered = rendered.split('{{earningsDeductionsRows}}').join(rowsHtml);
  }

  return rendered;
};

/**
 * Format payroll data for the engine
 */
exports.prepareDataForTemplate = (payroll, settings = {}) => {
  const breakdown = decryptJson(payroll.breakdown) || {};
  const attendance = decryptJson(payroll.attendance) || {};
  const employeeInfo = decryptJson(payroll.employeeInfo) || {};
  const bankDetails = decryptJson(payroll.bankDetails) || {};
  const currencySymbol = settings?.payroll?.currencySymbol || '₹';
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const format = (val) => `${currencySymbol}${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // 1. Process Earnings
  const earnings = {};
  const earningsList = (Array.isArray(breakdown.earnings) ? breakdown.earnings : breakdown.earnings?.components) || [];
  if (Array.isArray(earningsList)) {
      earningsList.forEach(e => {
          if (e.name && e.value != null) earnings[e.name] = format(e.value);
      });
  }

  // 2. Process Deductions
  const deductions = {};
  const deductionsList = (Array.isArray(breakdown.deductions) ? breakdown.deductions : breakdown.deductions?.components) || [];
  if (Array.isArray(deductionsList)) {
      deductionsList.forEach(d => {
          if (d.name && d.value != null) deductions[d.name] = format(d.value);
      });
  }
  
    // Attendance: priority is engine calculation (stored in breakdown) over raw attendance snapshot
    const calDays = breakdown.standardMonthlyDays || attendance?.standardMonthlyDays || attendance?.totalOrgWorkingDays || 30;
    const adjWorkingDays = breakdown.workingDays || attendance?.workingDays || 30;
    const payableDaysVal = breakdown.payableDays || attendance?.presentDays || Math.max(0, adjWorkingDays - (breakdown.lopDays || attendance?.lopDays || 0));
    const lopDaysVal = breakdown.lopDays || attendance?.lopDays || 0;

  return {
    employeeName: employeeInfo.name || 'N/A',
    employeeId: employeeInfo.employeeId || 'N/A',
    department: employeeInfo.department || 'N/A',
    designation: employeeInfo.designation || 'N/A',
    joiningDate: employeeInfo.joiningDate ? new Date(employeeInfo.joiningDate).toLocaleDateString('en-GB') : 'N/A',
    bankName: bankDetails.bankName || 'N/A',
    accountNo: bankDetails.accountNumber ? bankDetails.accountNumber.toString().replace(/.(?=.{4})/g, '*') : 'N/A',
    panId: bankDetails.pan ? bankDetails.pan.toString().replace(/.(?=.{4})/g, '*') : 'N/A',
    grossEarnings: format(payroll.gross || payroll.grossYield || breakdown.grossPay || 0),
    totalDeductions: format(payroll.totalDeductions || payroll.liability || breakdown.totalDeductions || 0),
    netPay: format(payroll.netPay || payroll.netSalary || 0),
    standardWorkingDays: calDays,
    individualWorkingDays: adjWorkingDays,
    payableDays: payableDaysVal,
    lopDays: lopDaysVal,
    overtimeHours: (payroll.overtimeHours || breakdown.overtimeHours) || 0,
    refNo: (payroll.id || '').toString().slice(-8).toUpperCase(),
    monthName: monthNames[(payroll.month || 1) - 1],
    year: payroll.year,
    companyName: settings?.organization?.companyName || 'TIMS',
    companyAddress: settings?.organization?.address || '',
    amountInWords: numberToWords(Math.floor(payroll.netPay || payroll.netSalary || 0)),
    earnings,
    deductions
  };
};

