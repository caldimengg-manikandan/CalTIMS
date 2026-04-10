'use strict';

const policyService = require('./policy.service');
const logger = require('../../shared/utils/logger');
const { prisma } = require('../../config/database');

const payrollService = require('../payroll/payroll.service');
const { startOfMonth, getDaysInMonth } = require('date-fns');

const getPayrollPolicy = async (req, res) => {
  try {
    const organizationId = req.organizationId || null;
    const policy = await policyService.getPolicy(organizationId);
    res.status(200).json(policy);
  } catch (error) {
    logger.error('Error fetching payroll policy: ' + error.message);
    res.status(500).json({ message: 'Error fetching payroll policy', error: error.message });
  }
};

const updatePayrollPolicy = async (req, res) => {
  try {
    const organizationId = req.organizationId || null;
    const updatedPolicy = await policyService.updatePolicy(req.body, organizationId);
    res.status(200).json(updatedPolicy);
  } catch (error) {
    logger.error('Error updating payroll policy: ' + error.message);
    res.status(500).json({ message: 'Error updating payroll policy', error: error.message });
  }
};

const createNewPolicyVersion = async (req, res) => {
  try {
    const organizationId = req.organizationId || null;
    const newPolicy = await policyService.createPolicyVersion(req.body, organizationId);
    res.status(201).json(newPolicy);
  } catch (error) {
    logger.error('Error creating policy version: ' + error.message);
    res.status(500).json({ message: 'Error creating policy version', error: error.message });
  }
};

const previewPolicyCalculation = async (req, res) => {
  try {
    const policy = req.body;
    const organizationId = req.organizationId;

    const mockUserRecord = organizationId ? await prisma.user.findFirst({ where: { organizationId, isActive: true } }) : null;
    const mockUser = mockUserRecord || { name: 'Sample Employee', role: 'Employee', id: 'preview-user' };
    
    const mockProfileRecord = mockUserRecord ? await prisma.payrollProfile.findFirst({ where: { user: mockUserRecord.id, organizationId } }) : null;
    const mockProfile = mockProfileRecord || { monthlyCTC: 50000, earnings: [], deductions: [] };
    if (!policy.salaryComponents) policy.salaryComponents = [];
    
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = startOfMonth(new Date(year, month - 1));
    
    const attendance = {
      totalHours: (policy.attendance?.workingDaysPerMonth || 22) * (policy.attendance?.workingHoursPerDay || 8),
      payableDays: policy.attendance?.workingDaysPerMonth || 22,
      lopDays: 0,
      workedDays: policy.attendance?.workingDaysPerMonth || 22,
      overtimeHours: 0,
      workingDays: policy.attendance?.workingDaysPerMonth || 22,
      hoursPerDay: policy.attendance?.workingHoursPerDay || 8
    };

    const contextData = {
      userCTC: mockProfile.monthlyCTC,
      effectivePayrollType: 'Monthly',
      totalDaysInMonth: getDaysInMonth(startDate),
      startDate,
      user: mockUser
    };

    const breakdown = payrollService.calculateSalaryBreakdown(policy, mockProfile, attendance, contextData);
    res.status(200).json({ breakdown, sampleEmployee: mockUser.name, ctc: mockProfile.monthlyCTC });
  } catch (error) {
    logger.error('Error previewing calculation: ' + error.message);
    res.status(500).json({ message: 'Error previewing calculation', error: error.message });
  }
};

module.exports = {
  getPayrollPolicy,
  updatePayrollPolicy,
  createNewPolicyVersion,
  previewPolicyCalculation
};
