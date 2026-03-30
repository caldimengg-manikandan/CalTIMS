'use strict';

const mongoose = require('mongoose');
const User = require('../users/user.model');
const PayrollProfile = require('./payrollProfile.model');
const RoleSalaryStructure = require('./roleSalaryStructure.model');
const ProcessedPayroll = require('./processedPayroll.model');
const Settings = require('../settings/settings.model');
const payrollService = require('./payroll.service');
const payslipService = require('./payslip.service');
const pdfGeneratorService = require('../reports/pdfGenerator.service');
const emailService = require('../../shared/services/email.service');
const auditService = require('../audit/audit.service');
const logger = require('../../shared/utils/logger');

// ─── Settings & Config ────────────────────────────────────────────────────────
exports.getConfig = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    res.status(200).json({
      success: true,
      data: settings?.payroll || {}
    });
  } catch (err) {
    next(err);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    if (!settings) return res.status(404).json({ success: false, message: 'Settings not found' });
    
    settings.payroll = { ...settings.payroll, ...req.body };
    await settings.save();
    
    // Audit Log
    await auditService.log(req.user?.id, 'POLICY_UPDATE', 'PayrollPolicy', settings._id, req.body, 'SUCCESS', req.ip);
    
    res.status(200).json({
      success: true,
      data: settings.payroll
    });
  } catch (err) {
    next(err);
  }
};

// ─── Salary Structures (CRUD) ────────────────────────────────────────────────
exports.getAllRoleStructures = async (req, res, next) => {
  try {
    const structures = await RoleSalaryStructure.find({ organizationId: req.organizationId }).sort({ isActive: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: structures });
  } catch (err) {
    next(err);
  }
};

exports.getStructureById = async (req, res, next) => {
  try {
    const structure = await RoleSalaryStructure.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!structure) return res.status(404).json({ success: false, message: 'Structure not found' });
    res.status(200).json({ success: true, data: structure });
  } catch (err) {
    next(err);
  }
};

exports.createOrUpdateRoleStructure = async (req, res, next) => {
  try {
    const { _id, __v, createdAt, updatedAt, ...structureData } = req.body;
    
    // Clean up empty strings for component values
    if (structureData.earnings) {
        structureData.earnings = structureData.earnings.map(e => ({ ...e, value: e.value === '' ? 0 : e.value }));
    }
    if (structureData.deductions) {
        structureData.deductions = structureData.deductions.map(d => ({ ...d, value: d.value === '' ? 0 : d.value }));
    }
    
    let structure;
    if (_id) {
       structure = await RoleSalaryStructure.findOneAndUpdate({ _id, organizationId: req.organizationId }, structureData, { new: true });
       await auditService.log(req.user?.id, 'STRUCTURE_UPDATE', 'SalaryStructure', structure._id, structureData, 'SUCCESS', req.ip, req.organizationId);
    } else {
       structure = await RoleSalaryStructure.create({ ...structureData, organizationId: req.organizationId });
       await auditService.log(req.user?.id, 'STRUCTURE_CREATE', 'SalaryStructure', structure._id, structureData, 'SUCCESS', req.ip, req.organizationId);
    }
    res.status(200).json({ success: true, data: structure });
  } catch (err) {
    next(err);
  }
};

exports.toggleStructureStatus = async (req, res, next) => {
  try {
    const structure = await RoleSalaryStructure.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!structure) return res.status(404).json({ success: false, message: 'Structure not found' });

    // If we're deactivating, check if anyone is using it
    if (structure.isActive) {
      const assignedProfiles = await PayrollProfile.countDocuments({ salaryStructureId: req.params.id, organizationId: req.organizationId });
      if (assignedProfiles > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `This structure is currently assigned to ${assignedProfiles} employee(s). Please reassign them before deactivating.` 
        });
      }
    }

    structure.isActive = !structure.isActive;
    await structure.save();

    res.status(200).json({ 
      success: true, 
      message: `Structure ${structure.isActive ? 'activated' : 'deactivated'} successfully`,
      data: structure
    });
  } catch (err) {
    next(err);
  }
};

exports.hardDeleteStructure = async (req, res, next) => {
  try {
    const assignedProfiles = await PayrollProfile.countDocuments({ salaryStructureId: req.params.id });
    if (assignedProfiles > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Critcal: This structure is assigned to ${assignedProfiles} employee(s). Permanently deleting it will break their historical data. Please reassign first.` 
      });
    }

    await RoleSalaryStructure.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Structure permanently deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Employee Profiles ───────────────────────────────────────────────────────
exports.getAllProfiles = async (req, res, next) => {
  try {
    const profiles = await PayrollProfile.find({ organizationId: req.organizationId }).populate('user', 'name employeeId department designation');
    res.status(200).json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await PayrollProfile.findOne({ user: req.params.userId, organizationId: req.organizationId }).populate('user', 'name employeeId department designation');
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

exports.createOrUpdateProfile = async (req, res, next) => {
  try {
    const { user, userId, _id, __v, createdAt, updatedAt, ...updateData } = req.body;
    const targetUserId = user || userId;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Handle empty string for ObjectId and Number fields
    if (updateData.salaryStructureId === '') {
      updateData.salaryStructureId = null;
    }

    ['weeklyRate', 'hourlyRate', 'dailyRate', 'monthlyCTC'].forEach(field => {
      if (updateData[field] === '') {
        updateData[field] = 0;
      }
    });

    let profile = await PayrollProfile.findOne({ user: targetUserId, organizationId: req.organizationId });
    
    if (profile) {
      // Update existing
      Object.assign(profile, updateData);
      await profile.save();
    } else {
      // Create new
      profile = await PayrollProfile.create({ 
        user: targetUserId, 
        organizationId: req.organizationId,
        ...updateData 
      });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    logger.error('Error in createOrUpdateProfile:', {
        body: req.body,
        error: err.message,
        stack: err.stack,
        code: err.code
    });
    next(err);
  }
};

exports.deleteProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    await PayrollProfile.findOneAndDelete({ _id: id, organizationId: req.organizationId });
    res.status(200).json({ success: true, message: 'Profile deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Processing & Simulation ─────────────────────────────────────────────────
exports.runPayrollExecution = async (req, res, next) => {
  try {
    const { month, year, payslipTemplateId } = req.body;
    const organizationId = req.organizationId;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are mandatory' });

    const executionStats = await payrollService.runPayroll({ 
      month: parseInt(month), 
      year: parseInt(year), 
      organizationId,
      processedBy: req.user?.id,
      payslipTemplateId
    });

    // Audit: track payroll executions
    auditService.log(
      req.user?.id,
      'RUN_PAYROLL',
      'Payroll',
      null,
      { month, year, successCount: executionStats.successCount, failedCount: executionStats.failedCount },
      executionStats.failedCount > 0 ? 'WARNING' : 'SUCCESS',
      req.ip,
      req.organizationId
    ).catch(() => {});

    // HARD VALIDATION: Prevents false success responses
    if (!executionStats.details || executionStats.details.length === 0) {
      throw new Error("Payroll calculation failed - no records generated. Potential engine logic fault.");
    }

    // Standardized Enterprise Response Structure
    res.status(200).json({
      success: true,
      data: executionStats.details,
      status: executionStats.batchStatus,
      total: executionStats.details.length,
      message: executionStats.batchStatus === 'Warning' 
        ? `Payroll processed with warnings! Check execution logs.`
        : `Payroll processed for ${executionStats.details.length} employees successfully!`
    });
  } catch (err) {
    next(err);
  }
};

exports.simulatePayroll = async (req, res, next) => {
  try {
    const { month, year, department, branch, designation, employeeId, bankName, location } = req.body;
    const organizationId = req.organizationId;
    
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are mandatory' });

    let userQuery = { isActive: true };
    if (department) userQuery.department = department;
    if (branch) userQuery.branch = branch;
    if (location) userQuery.branch = location; // alias
    if (designation) userQuery.designation = designation;
    if (employeeId) userQuery.employeeId = employeeId;
    if (bankName) userQuery.bankName = bankName;
    userQuery.isActive = true;
    userQuery.organizationId = organizationId;

    const users = await User.find(userQuery).select('_id name email employeeId department designation branch role bankName accountNumber ifscCode uan pan aadhaar').lean();
    
    const simulations = [];
    const profiles = await PayrollProfile.find({ user: { $in: users.map(u => u._id) }, organizationId }).lean();
    
    for (const u of users) {
      const profile = profiles.find(p => p.user.toString() === u._id.toString());
      if (profile && profile.isActive === false) continue; // Skip disabled profiles

      try {
        const simulation = await payrollService.simulateUserPayroll(u._id, parseInt(month), parseInt(year), organizationId);
        simulations.push(simulation);
      } catch (err) {
        simulations.push({ 
          user: { id: u._id, name: u.name, employeeId: u.employeeId, department: u.department }, 
          error: err.message 
        });
      }
    }

    res.status(200).json({ success: true, data: simulations });
  } catch (err) {
    next(err);
  }
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
        results.push(saved._id);
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
  } catch (err) {
    next(err);
  }
};

exports.lockPayrollMonth = async (req, res, next) => {
    // Legacy Alias for finalize
    return exports.finalizePayroll(req, res, next);
};

exports.finalizePayroll = async (req, res, next) => {
    // Legacy support for finalizing - now redirects to submitForApproval if HR
    return exports.submitForApproval(req, res, next);
};

exports.submitForApproval = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const organizationId = req.organizationId;
        if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year required' });

        const result = await payrollService.submitForApproval({
            month: parseInt(month),
            year: parseInt(year),
            organizationId,
            userId: req.user.id
        });

        await auditService.log(req.user?.id, 'SUBMIT_PAYROLL', 'Payroll', null, { month, year }, 'SUCCESS', req.ip, req.organizationId);
        
        res.status(200).json({ 
            success: true, 
            message: `Payroll for ${month}/${year} submitted for Finance approval.`,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.approvePayroll = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const organizationId = req.organizationId;
        const result = await payrollService.approvePayroll({
            month: parseInt(month),
            year: parseInt(year),
            organizationId,
            userId: req.user.id
        });

        await auditService.log(req.user?.id, 'APPROVE_PAYROLL', 'Payroll', null, { month, year }, 'SUCCESS', req.ip, organizationId);

        res.status(200).json({ 
            success: true, 
            message: `Payroll for ${month}/${year} approved by Finance.`,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.reopenPayroll = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const organizationId = req.organizationId;
        const result = await payrollService.reopenPayroll({
            month: parseInt(month),
            year: parseInt(year),
            organizationId,
            userId: req.user.id
        });

        await auditService.log(req.user?.id, 'REOPEN_PAYROLL', 'Payroll', null, { month, year }, 'SUCCESS', req.ip, organizationId);

        res.status(200).json({ 
            success: true, 
            message: `Payroll for ${month}/${year} reopened for corrections.`,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.markAsPaid = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const organizationId = req.organizationId;
        
        // 🛡️ DEFENSIVE VALIDATION: Explicitly check for 'disburse' permission as a backstop
        const settings = await Settings.findOne({ organizationId }).lean();
        const userRole = settings?.roles?.find(r => r.name.toLowerCase() === req.user.role?.toLowerCase());
        const hasDisbursePerm = userRole?.permissions?.['Payroll']?.['Payroll Engine']?.includes('disburse');
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role?.toLowerCase());

        if (!isAdmin && !hasDisbursePerm) {
            await auditService.log(req.user.id, 'UNAUTHORIZED_PAYMENT_ATTEMPT', 'Payroll', null, { month, year, role: req.user.role }, 'SECURITY_WARNING', req.ip, organizationId);
            return res.status(403).json({ 
                success: false, 
                message: 'Access Denied: You do not have the required "disburse" authority to mark payroll as paid.' 
            });
        }

        const result = await payrollService.markAsPaid({
            month: parseInt(month),
            year: parseInt(year),
            organizationId,
            processedBy: req.user.id
        });

        await auditService.log(req.user?.id, 'MARK_AS_PAID', 'Payroll', null, { month, year }, 'SUCCESS', req.ip, organizationId);

        res.status(200).json({ 
            success: true, 
            message: `Payroll for ${month}/${year} marked as PAID.`,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.hardLock = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const organizationId = req.organizationId;
        const result = await payrollService.hardLockMonth({
            month: parseInt(month),
            year: parseInt(year),
            organizationId,
            lockedBy: req.user.id
        });

        await auditService.log(req.user?.id, 'HARD_LOCK', 'Payroll', null, { month, year }, 'SUCCESS', req.ip, organizationId);

        res.status(200).json({ 
            success: true, 
            message: `Payroll for ${month}/${year} is now permanently LOCKED.`,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

exports.processBulk = async (req, res, next) => {
    // Enterprise Alias for savePayroll
    return exports.savePayroll(req, res, next);
};

exports.getPayrollHistory = async (req, res, next) => {
  try {
    const { month, year, userId, department } = req.query;
    let query = { organizationId: req.organizationId };
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (userId) query.user = userId;

    let history = await ProcessedPayroll.find(query)
      .populate('user', 'name employeeId department designation branch email joinDate isActive bankName accountNumber ifscCode uan pan aadhaar')
      .sort({ createdAt: -1 });

    if (department) {
      history = history.filter(h => h.user?.department === department);
    }
      
    res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

// ─── Payslips ────────────────────────────────────────────────────────────────
exports.getMyPayslips = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const organizationId = req.organizationId;
    let query = { user: req.user.id, organizationId };
    
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);

    const payslips = await ProcessedPayroll.find(query)
      .populate('user', 'name employeeId department designation branch email bankName accountNumber ifscCode uan pan aadhaar')
      .sort({ year: -1, month: -1 });
    res.status(200).json({ success: true, data: payslips });
  } catch (err) {
    next(err);
  }
};

exports.getPayslip = async (req, res, next) => {
  try {
    const payslip = await ProcessedPayroll.findOne({ _id: req.params.id, organizationId: req.organizationId })
       .populate('user', 'name employeeId department designation branch email bankName accountNumber ifscCode uan pan aadhaar');
    res.status(200).json({ success: true, data: payslip });
  } catch (err) {
    next(err);
  }
};

exports.getPayslipByUserId = async (req, res, next) => {
    try {
        const { employeeId } = req.params; // This matches both mongoId or employeeCode depending on front-end logic
        const { month, year } = req.query;
        const organizationId = req.organizationId;

        let query = { user: employeeId, organizationId };
        // If employeeId is NOT a mongoId, try matching by employeeCode via join
        if (!mongoose.Types.isValidObjectId(employeeId)) {
            const user = await User.findOne({ employeeId: employeeId, organizationId });
            if (!user) return res.status(404).json({ success: false, message: 'Employee not found' });
            query.user = user._id;
        }

        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);

        const payslip = await ProcessedPayroll.findOne(query).sort({ createdAt: -1 })
            .populate('user', 'name employeeId department designation branch email bankName accountNumber ifscCode uan pan aadhaar');
        
        if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found for this employee/period' });
        res.status(200).json({ success: true, data: payslip });
    } catch (err) {
        next(err);
    }
};

// ─── Exports ─────────────────────────────────────────────────────────────────
exports.exportBankFile = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const history = await ProcessedPayroll.find({ month, year, organizationId: req.organizationId, status: 'Completed' }).populate('user');
    
    const exportData = history.map(p => ({
      employeeId: p.user.employeeId,
      name: p.user.name,
      bankName: p.user.bankName,
      accountNumber: p.user.accountNumber,
      ifsc: p.user.ifscCode,
      netPay: p.breakdown.netPay
    }));

    res.status(200).json({ success: true, data: exportData });
  } catch (err) {
    next(err);
  }
};

// ─── Reporting ───────────────────────────────────────────────────────────────
exports.getPayrollSummaryReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const organizationId = req.organizationId;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are required' });
    const summary = await payrollService.getPayrollSummary(parseInt(month), parseInt(year), organizationId);
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
};

exports.getDepartmentAnalysisReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const organizationId = req.organizationId;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and Year are required' });
    const analysis = await payrollService.getDepartmentCostAnalysis(parseInt(month), parseInt(year), organizationId);
    res.status(200).json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
};

exports.downloadPayslipPDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;
    const payroll = await ProcessedPayroll.findOne({ _id: id, organizationId }).populate('user');
    
    if (!payroll) {
        return res.status(404).json({ success: false, message: 'Payslip record not found' });
    }

    if (!['Processed', 'Warning', 'Completed', 'Paid'].includes(payroll.status)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Payslip is not yet finalized. Status must be Processed, Completed or Paid.' 
        });
    }

    const settings = await Settings.findOne();
    
    // Use the premium PDF generator with full context
    const mappedData = _mapPayrollToReportData(payroll, settings);
    const pdfBuffer = await pdfGeneratorService.generatePayslipBuffer(mappedData, settings);

    const empId = payroll.employeeInfo?.employeeId || payroll.user?.employeeId || 'NA';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Payslip-${empId}-${payroll.month}-${payroll.year}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (err) {
    next(err);
  }
};

exports.sendPayslipEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;
    const payroll = await ProcessedPayroll.findOne({ _id: id, organizationId }).populate('user');
    
    if (!payroll) return res.status(404).json({ success: false, message: 'Payslip record not found' });
    
    const email = payroll.user?.email || payroll.employeeInfo?.email;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Employee email address is missing. Please update employee profile.' });
    }

    const settings = await Settings.findOne({ organizationId });
    const mappedData = _mapPayrollToReportData(payroll, settings);

    // Call internal email service
    await emailService.sendPayslipEmail(email, mappedData);
    
    // Update model to reflect success
    payroll.isEmailSent = true;
    payroll.lastEmailSentAt = new Date();
    await payroll.save();
    
    res.status(200).json({ success: true, message: 'Payslip emailed successfully' });
  } catch (err) {
    logger.error(`[PayrollController] Single payslip dispatch failed for ${req.params.id}: ${err.message}`, { stack: err.stack });
    next(err);
  }
};

exports.bulkSendPayslipEmails = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ success: false, message: 'No payslips selected' });

    const organizationId = req.organizationId;
    const payrolls = await ProcessedPayroll.find({ _id: { $in: ids }, organizationId }).populate('user');
    const settings = await Settings.findOne({ organizationId });
    
    const bulkData = payrolls.map(p => ({
        email: p.user?.email || p.employeeInfo?.email,
        data: _mapPayrollToReportData(p, settings)
    })).filter(x => x.email);

    const bulkResults = await emailService.sendPayslipsBulk(bulkData);
    
    // Update database for all successful ones
    if (bulkResults.sent > 0) {
        const failedEmails = new Set(bulkResults.errors.map(e => e.email));
        const successfulIds = payrolls
            .filter(p => !failedEmails.has(p.user?.email || p.employeeInfo?.email))
            .map(p => p._id);
        
        if (successfulIds.length > 0) {
            await ProcessedPayroll.updateMany(
                { _id: { $in: successfulIds } },
                { $set: { isEmailSent: true, lastEmailSentAt: new Date() } }
            );
        }
    }
    
    res.status(200).json({ 
        success: true, 
        message: `${bulkResults.sent} payslips dispatched successfully, ${bulkResults.failed} failures.`,
        data: bulkResults 
    });
  } catch (err) {
    logger.error(`[PayrollController] Fatal error in bulk dispatch: ${err.message}`, { stack: err.stack });
    next(err);
  }
};

/**
 * Internal: Map DB record to the structure expected by PDF/Email services
 */
function _mapPayrollToReportData(payroll, settings) {
    const breakdown = payroll.breakdown || {};
    return {
        user: payroll.user,
        month: payroll.month,
        year: payroll.year,
        breakdown: {
            ...breakdown,
            earnings: {
                components: breakdown.earnings?.components || [],
                grossEarnings: breakdown.earnings?.grossEarnings || payroll.grossYield || 0
            },
            deductions: {
                components: breakdown.deductions?.components || [],
                totalDeductions: breakdown.deductions?.totalDeductions || payroll.liability || 0
            },
            netPay: breakdown.netPay || payroll.netPay || 0,
            lopDeduction: breakdown.lopDeduction || 0
        },
        attendance: {
            workingDays: payroll.attendance?.workingDays || 30,
            workedDays: payroll.attendance?.workedDays || 0,
            lopDays: payroll.attendance?.lopDays || 0,
            overtimeHours: payroll.attendance?.overtimeHours || 0
        },
        currencySymbol: settings?.payroll?.currencySymbol || '₹',
        employeeInfo: {
            name: payroll.user?.name || payroll.employeeInfo?.name || 'Unknown',
            employeeId: payroll.user?.employeeId || payroll.employeeInfo?.employeeId || 'N/A',
            department: payroll.user?.department || payroll.employeeInfo?.department || 'N/A',
            designation: payroll.user?.designation || payroll.employeeInfo?.designation || 'N/A'
        },
        bankDetails: {
            bankName: payroll.user?.bankName || payroll.bankDetails?.bankName,
            accountNumber: payroll.user?.accountNumber || payroll.bankDetails?.accountNumber,
            ifsc: payroll.user?.ifscCode || payroll.bankDetails?.ifsc,
            pan: payroll.user?.pan || payroll.bankDetails?.pan,
            uan: payroll.user?.uan || payroll.bankDetails?.uan
        }
    };
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
exports.getDashboardData = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await payrollService.getPayrollDashboard(month, year, req.organizationId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
};

/**
 * GET /payroll/batches
 * Returns all PayrollBatch documents (one per payroll run), newest first.
 * Replaces the client-side grouping approach in PayrollHistory.jsx.
 */
exports.getPayrollBatchHistory = async (req, res, next) => {
  try {
    const batches = await payrollService.getPayrollBatches(req.organizationId);
    res.status(200).json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
};
