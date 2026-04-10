'use strict';

const { prisma } = require('../../config/database');
const payrollService = require('./payroll.service');
const pdfGeneratorService = require('../reports/pdfGenerator.service');
const payslipService = require('./payslip.service');
const emailService = require('../../shared/services/email.service');
const auditService = require('../audit/audit.service');
const logger = require('../../shared/utils/logger');
const { AppError } = require('../../shared/utils/AppError');

// ─── Settings & Config ────────────────────────────────────────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId: req.organizationId } });
    res.status(200).json({ success: true, data: orgSettings?.data?.payroll || {} });
  } catch (err) { next(err); }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId: req.organizationId } });
    const current = orgSettings?.data || {};
    const merged = { ...current, payroll: { ...(current.payroll || {}), ...req.body } };
    await prisma.orgSettings.upsert({ 
      where: { organizationId: req.organizationId }, 
      update: { data: merged }, 
      create: { organizationId: req.organizationId, data: merged } 
    });
    await auditService.log(req.user?.id, 'POLICY_UPDATE', 'OrgSettings', null, req.body, 'SUCCESS', req.ip, req.organizationId);
    res.status(200).json({ success: true, data: merged.payroll });
  } catch (err) { next(err); }
};

// ─── Salary Structures (CRUD) ────────────────────────────────────────────────
exports.getAllRoleStructures = async (req, res, next) => {
  try {
    const structures = await prisma.roleSalaryStructure.findMany({ 
      where: { organizationId: req.organizationId, isDeleted: false }, 
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] 
    });
    res.status(200).json({ success: true, data: structures });
  } catch (err) { next(err); }
};

exports.getStructureById = async (req, res, next) => {
  try {
    const structure = await prisma.roleSalaryStructure.findFirst({ 
      where: { id: req.params.id, organizationId: req.organizationId, isDeleted: false } 
    });
    if (!structure) return res.status(404).json({ success: false, message: 'Structure not found' });
    res.status(200).json({ success: true, data: structure });
  } catch (err) { next(err); }
};

exports.createOrUpdateRoleStructure = async (req, res, next) => {
  try {
    const { id, createdAt, updatedAt, ...structureData } = req.body;
    const organizationId = req.organizationId;
    const now = new Date();
    let structure;
    if (id) {
      await prisma.roleSalaryStructure.update({ where: { id }, data: { effectiveTo: now, isActive: false } });
      structure = await prisma.roleSalaryStructure.create({ 
        data: { ...structureData, organizationId, effectiveFrom: now, isActive: true } 
      });
      await auditService.log(req.user?.id, 'STRUCTURE_VERSION_CREATED', 'RoleSalaryStructure', structure.id, { parentId: id }, 'SUCCESS', req.ip, organizationId);
    } else {
      structure = await prisma.roleSalaryStructure.create({ 
        data: { ...structureData, organizationId, effectiveFrom: now, isActive: true } 
      });
      await auditService.log(req.user?.id, 'STRUCTURE_CREATE', 'RoleSalaryStructure', structure.id, structureData, 'SUCCESS', req.ip, organizationId);
    }
    res.status(200).json({ success: true, data: structure });
  } catch (err) { next(err); }
};

exports.toggleStructureStatus = async (req, res, next) => {
  try {
    const structure = await prisma.roleSalaryStructure.findFirst({ 
      where: { id: req.params.id, organizationId: req.organizationId } 
    });
    if (!structure) return res.status(404).json({ success: false, message: 'Structure not found' });
    
    if (structure.isActive) {
      const count = await prisma.payrollProfile.count({ 
        where: { salaryStructureId: req.params.id, organizationId: req.organizationId } 
      });
      if (count > 0) return res.status(400).json({ success: false, message: `This structure is assigned to ${count} employee(s). Please reassign before deactivating.` });
    }
    const updated = await prisma.roleSalaryStructure.update({ 
      where: { id: req.params.id }, 
      data: { isActive: !structure.isActive } 
    });
    res.status(200).json({ success: true, message: `Structure ${updated.isActive ? 'activated' : 'deactivated'}`, data: updated });
  } catch (err) { next(err); }
};

exports.hardDeleteStructure = async (req, res, next) => {
  try {
    const count = await prisma.payrollProfile.count({ where: { salaryStructureId: req.params.id } });
    if (count > 0) return res.status(400).json({ success: false, message: `Structure is assigned to ${count} employee(s). Please reassign first.` });
    await prisma.roleSalaryStructure.update({ where: { id: req.params.id }, data: { isDeleted: true, deletedAt: new Date(), isActive: false } });
    res.status(200).json({ success: true, message: 'Structure deleted successfully' });
  } catch (err) { next(err); }
};

// ─── Employee Profiles ───────────────────────────────────────────────────────
exports.getAllProfiles = async (req, res, next) => {
  try {
    const profiles = await prisma.payrollProfile.findMany({ 
      where: { organizationId: req.organizationId }, 
      include: { 
        employee: { 
          include: { 
            user: { select: { name: true } },
            department: { select: { name: true } },
            designation: { select: { name: true } }
          } 
        } 
      } 
    });
    res.status(200).json({ success: true, data: profiles });
  } catch (err) { next(err); }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await prisma.payrollProfile.findFirst({ 
      where: { employee: { userId: req.params.userId }, organizationId: req.organizationId }, 
      include: { 
        employee: { 
          include: { 
            user: { select: { name: true } },
            department: { select: { name: true } },
            designation: { select: { name: true } }
          } 
        } 
      } 
    });
    res.status(200).json({ success: true, data: profile });
  } catch (err) { next(err); }
};

exports.getProfileByEmployeeId = async (req, res, next) => {
  try {
    const profile = await prisma.payrollProfile.findFirst({ 
      where: { employeeId: req.params.employeeId, organizationId: req.organizationId }, 
      include: { 
        employee: { 
          include: { 
            user: true,
            department: { select: { name: true } },
            designation: { select: { name: true } }
          } 
        } 
      } 
    });
    res.status(200).json({ success: true, data: profile });
  } catch (err) { next(err); }
};

exports.createOrUpdateProfile = async (req, res, next) => {
  try {
    const { employeeId, id, createdAt, updatedAt, ...updateData } = req.body;
    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID is required' });
    
    if (updateData.salaryStructureId === '') updateData.salaryStructureId = null;
    ['monthlyCTC'].forEach(field => { if (updateData[field] === '') updateData[field] = 0; });
    
    const profile = await prisma.payrollProfile.upsert({
      where: { employeeId },
      update: updateData,
      create: { employeeId, organizationId: req.organizationId, ...updateData },
    });
    res.status(200).json({ success: true, data: profile });
  } catch (err) { logger.error('Error in createOrUpdateProfile:', err.message); next(err); }
};

exports.deleteProfile = async (req, res, next) => {
  try {
    await prisma.payrollProfile.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Profile deleted successfully' });
  } catch (err) { next(err); }
};

exports.setupFullProfile = async (req, res, next) => {
  try {
    const result = await payrollService.upsertFullPayrollProfile(
      req.body,
      req.organizationId,
      req.user?.id
    );
    res.status(200).json({ success: true, data: result, message: 'Payroll Profile successfully configured.' });
  } catch (err) { next(err); }
};

// ─── Processing & Simulation ─────────────────────────────────────────────────
exports.runPayrollExecution = async (req, res, next) => {
  try {
    const { month, year, payslipTemplateId, overtimeEnabled } = req.body;
    const organizationId = req.organizationId;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are mandatory' });

    const executionStats = await payrollService.runPayroll({ 
      month: parseInt(month), 
      year: parseInt(year), 
      organizationId,
      processedBy: req.user?.id,
      payslipTemplateId,
      overtimeEnabled
    });

    auditService.log(
      req.user?.id,
      'RUN_PAYROLL',
      'PayrollBody',
      null,
      { month, year, successCount: executionStats.successCount, failedCount: executionStats.failedCount },
      executionStats.failedCount > 0 ? 'WARNING' : 'SUCCESS',
      req.ip,
      req.organizationId
    ).catch(() => {});

    res.status(200).json({
      success: true,
      data: executionStats.details,
      status: executionStats.batchStatus,
      total: executionStats.details.length,
      message: executionStats.batchStatus === 'ERROR' 
        ? `Payroll processed with some failures. Check logs.`
        : `Payroll processed successfully for ${executionStats.details.length} employees!`
    });
  } catch (err) { next(err); }
};

exports.simulatePayroll = async (req, res, next) => {
  try {
    const { month, year, departmentId, designationId, employeeId } = req.body;
    const organizationId = req.organizationId;
    
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are mandatory' });

    const where = { organizationId, status: 'ACTIVE', isDeleted: false };
    if (departmentId) where.departmentId = departmentId;
    if (designationId) where.designationId = designationId;
    if (employeeId) where.id = employeeId;

    const employees = await prisma.employee.findMany({ 
        where,
        include: { user: true, department: true, designation: true }
    });
    
    const simulations = [];
    for (const emp of employees) {
      try {
        const simulation = await payrollService.simulateUserPayroll(emp.userId, parseInt(month), parseInt(year), organizationId);
        simulations.push(simulation);
      } catch (err) {
        simulations.push({ 
          user: { id: emp.userId, name: emp.user.name, employeeId: emp.employeeCode, department: emp.department?.name }, 
          error: err.message 
        });
      }
    }

    res.status(200).json({ success: true, data: simulations });
  } catch (err) { next(err); }
};

exports.savePayroll = async (req, res, next) => {
  try {
    const { payrolls } = req.body; 
    if (!payrolls || !Array.isArray(payrolls)) return res.status(400).json({ success: false, message: 'Payrolls array is required' });

    const results = [];
    const errors = [];

    for (const p of payrolls) {
      try {
        const saved = await payrollService.saveProcessedPayroll(p, req.organizationId);
        results.push(saved.id);
      } catch (err) {
        errors.push({ employeeId: p.user?.employeeId, error: err.message });
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Successfully saved ${results.length} records.`, 
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) { next(err); }
};

exports.markAsPaid = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const organizationId = req.organizationId;
        
        const result = await payrollService.markAsPaid({ 
             month: parseInt(month), 
             year: parseInt(year), 
             organizationId, 
             processedBy: req.user.id 
        });
        
        res.status(200).json({ success: true, message: `Payroll for ${month}/${year} marked as PAID.`, data: result });
    } catch (err) { next(err); }
};

exports.getPayrollHistory = async (req, res, next) => {
  try {
    const { month, year, employeeId } = req.query;
    const where = { organizationId: req.organizationId, isDeleted: false };
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (employeeId) where.employeeId = employeeId;
    
    const history = await prisma.processedPayroll.findMany({ 
        where, 
        include: { 
            employee: { 
                include: { 
                    user: { select: { name: true } }, 
                    department: { select: { name: true } } 
                } 
            },
            payslip: {
                select: { id: true, status: true }
            }
        }, 
        orderBy: { createdAt: 'desc' } 
    });
    res.status(200).json({ success: true, data: history });
  } catch (err) { next(err); }
};

exports.generatePayslips = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are required for generation.' });
    
    const results = await payrollService.generatePayslips(month, year, req.organizationId, req.user.id);
    res.status(200).json({ success: true, message: `${results.length} payslips generated successfully.`, data: results });
  } catch (err) { next(err); }
};

exports.getGeneratedPayslips = async (req, res, next) => {
  try {
    const { month, year, employeeId } = req.query;
    const filters = { month, year, employeeId, organizationId: req.organizationId };
    const payslips = await payrollService.getGeneratedPayslips(filters);
    res.status(200).json({ success: true, data: payslips });
  } catch (err) { next(err); }
};

exports.markPayslipAsPaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await payrollService.markPayslipAsPaid(id, req.organizationId, req.user.id);
    res.status(200).json({ success: true, message: 'Payslip marked as PAID.', data: updated });
  } catch (err) { next(err); }
};

exports.bulkMarkPayslipsAsPaid = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No payslip IDs provided.' });
    }
    const results = await payrollService.bulkMarkPayslipsAsPaid(ids, req.organizationId, req.user.id);
    res.status(200).json({
      success: true,
      message: `Marked ${results.success} payslip(s) as PAID.${results.failed > 0 ? ` ${results.failed} failed.` : ''}`,
      data: results
    });
  } catch (err) { next(err); }
};

// ─── Payslips ────────────────────────────────────────────────────────────────
exports.getMyPayslips = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const payslips = await payrollService.getEmployeePayslips(req.user.id, req.organizationId, month, year);
    res.status(200).json({ success: true, data: payslips });
  } catch (err) { next(err); }
};

exports.getPayslip = async (req, res, next) => {
  try {
    const payslip = await prisma.payslip.findFirst({ 
        where: { id: req.params.id, organizationId: req.organizationId }
    });
    res.status(200).json({ success: true, data: payslip });
  } catch (err) { next(err); }
};

// ─── Exports ─────────────────────────────────────────────────────────────────
exports.exportBankFile = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const history = await prisma.processedPayroll.findMany({ 
        where: { month: parseInt(month), year: parseInt(year), organizationId: req.organizationId, isPaid: true }
    });

    const exportData = history.map(p => ({ 
        employeeId: p.employeeInfo?.employeeId || '-', 
        name: p.employeeInfo?.name || '-', 
        bankName: p.bankDetails?.bankName || '-', 
        accountNumber: p.bankDetails?.accountNumber || '', 
        ifsc: p.bankDetails?.ifscCode || '', 
        netPay: p.netPay 
    }));
    res.status(200).json({ success: true, data: exportData });
  } catch (err) { next(err); }
};

// ─── Reporting ───────────────────────────────────────────────────────────────
exports.getPayrollSummaryReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are required' });
    const summary = await payrollService.getPayrollSummary(parseInt(month), parseInt(year), req.organizationId);
    res.status(200).json({ success: true, data: summary });
  } catch (err) { next(err); }
};

exports.getDepartmentAnalysisReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are required' });
    const data = await payrollService.getDepartmentCostAnalysis(parseInt(month), parseInt(year), req.organizationId);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getPayslipByUserId = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { month, year } = req.query;
        const organizationId = req.organizationId;
        
        const employee = await prisma.employee.findFirst({ 
            where: { OR: [{ id: employeeId }, { employeeCode: employeeId }], organizationId } 
        });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        
        const payroll = await prisma.processedPayroll.findFirst({
            where: { 
                employeeId,
                month: parseInt(month),
                year: parseInt(year),
                organizationId
            }
        });

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll record not found for this period.' });
        }

        res.status(200).json({ success: true, data: payroll });
    } catch (err) { next(err); }
};

exports.downloadPayslipPDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payslip = await prisma.payslip.findFirst({ 
        where: { id, organizationId: req.organizationId }
    });
    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip record not found' });
    
    // Use the optimized payslip service which handles template rendering and PDF generation
    const pdfBuffer = await payslipService.generatePayslipPdf(payslip.processedPayrollId, req.organizationId);
    
    const empId = payslip.employeeInfo?.employeeId || 'NA';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="Payslip-${empId}-${payslip.month}-${payslip.year}.pdf"`);
    res.end(pdfBuffer, 'binary');
  } catch (err) { 
    logger.error(`[Payroll] downloadPayslipPDF failed: ${err.message}`);
    next(err); 
  }
};

exports.sendPayslipEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payslip = await prisma.payslip.findFirst({ 
        where: { id, organizationId: req.organizationId }
    });
    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip record not found' });
    
    const email = payslip.employeeInfo?.email;
    if (!email) return res.status(400).json({ success: false, message: 'Employee email address is missing from snapshot.' });
    
    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId: req.organizationId } });
    const companyName = orgSettings?.data?.organization?.companyName || 'CALTIMS';
    
    // Pass raw payslip and organizationId to service
    await emailService.sendPayslipEmail(email, payslip, req.organizationId, companyName);
    
    await prisma.payslip.update({ where: { id }, data: { isEmailSent: true, status: 'SENT', lastEmailSentAt: new Date() } });
    res.status(200).json({ success: true, message: 'Payslip emailed successfully' });
  } catch (err) { logger.error(`[Payroll] sendPayslipEmail failed: ${err.message}`); next(err); }
};

exports.bulkSendPayslipEmails = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ success: false, message: 'No payslips selected' });
    
    const job = await prisma.payrollJob.create({ 
        data: { 
            organizationId: req.organizationId, 
            type: 'SEND_PAYSLIP_EMAILS', 
            payload: { ids, organizationId: req.organizationId }, 
            priority: 10 
        } 
    });
    res.status(200).json({ success: true, message: 'Payslip email dispatch queued.', data: { jobId: job.id } });
  } catch (err) { logger.error(`[Payroll] bulkSendPayslipEmails failed: ${err.message}`); next(err); }
};

function _mapPayrollToReportData(payroll, settings) {
    const breakdown = payroll.breakdown || {};
    const employeeInfo = payroll.employeeInfo || {};
    const bankDetails = payroll.bankDetails || {};

    return {
        user: { id: payroll.userId, name: employeeInfo.name }, 
        month: payroll.month,
        year: payroll.year,
        breakdown,
        attendance: payroll.attendance || {},
        currencySymbol: settings?.payroll?.currencySymbol || '₹',
        organizationId: payroll.organizationId,
        companyId: payroll.organizationId,
        employeeInfo: {
            name: employeeInfo.name || 'Unknown',
            employeeId: employeeInfo.employeeId || 'N/A',
            department: employeeInfo.department || 'N/A',
            designation: employeeInfo.designation || 'N/A',
            branch: employeeInfo.branch || 'N/A'
        },
        bankDetails: {
            bankName: bankDetails.bankName,
            accountNumber: bankDetails.accountNumber,
            ifsc: bankDetails.ifscCode || bankDetails.ifsc,
            pan: bankDetails.pan,
            uan: bankDetails.uan,
            aadhaar: bankDetails.aadhaar
        }
    };
}

exports.getDashboardData = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await payrollService.getPayrollDashboard(month, year, req.organizationId);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const filters = {
        month: req.query.month,
        year: req.query.year,
        department: req.query.department,
        organizationId: req.organizationId
    };
    const data = await payrollService.getPayrollAnalytics(filters);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getPayrollBatchHistory = async (req, res, next) => {
  try {
    const batches = await payrollService.getPayrollBatches(req.organizationId);
    res.status(200).json({ success: true, data: batches });
  } catch (err) { next(err); }
};

exports.getReadinessCheck = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are required' });
    
    const data = await payrollService.getReadinessCheck(req.organizationId, month, year);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getPreview = async (req, res, next) => {
  try {
    const { month, year, overtimeEnabled } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are mandatory' });
    
    const data = await payrollService.getPayrollPreview(req.organizationId, month, year, overtimeEnabled === 'true' || overtimeEnabled === true);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};
