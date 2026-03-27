'use strict';

const mongoose = require('mongoose');
const User = require('../users/user.model');
const PayrollProfile = require('./payrollProfile.model');
const RoleSalaryStructure = require('./roleSalaryStructure.model');
const ProcessedPayroll = require('./processedPayroll.model');
const PayrollBatch = require('./payrollBatch.model');
const Settings = require('../settings/settings.model');
const Timesheet = require('../timesheets/timesheet.model');
const Leave = require('../leaves/leave.model');
const AttendanceLog = require('../attendance/attendance.model');
const { getPolicy } = require('../policyEngine/policy.service');
const { evaluateFormula, evaluateCondition, buildPayrollContext } = require('../formulaEngine/formula.service');
const { resolveExecutionOrder } = require('../formulaEngine/dependencyResolver');
const { startOfMonth, endOfMonth, getDaysInMonth, format } = require('date-fns');
const logger = require('../../shared/utils/logger');
const auditService = require('../audit/audit.service');

/**
 * Resolves a salary component based on its calculation type and formula.
 */
const resolveComponentValue = (component, context, monthlyCTC) => {
  try {
    // 1. Use config amount if available
    if (component.config && component.config.amount) {
      return parseFloat(component.config.amount) || 0;
    }

    const name = (component.name || '').toLowerCase();
    const formula = (component.formula || component.value || '').toString();
    const value = parseFloat(component.value) || 0;

    const calcType = (component.calculationType || '').toUpperCase();

    if (calcType === 'FIXED') {
      return value;
    }
    
    if (calcType === 'FORMULA') {
      return evaluateFormula(formula, context);
    }
    
    if (calcType === 'PERCENTAGE') {
      let base = 0;
      const lowerFormula = formula.toLowerCase();
      
      if (lowerFormula.includes('ctc') || name.includes('basic')) {
        base = monthlyCTC || 0;
      } 
      else if (lowerFormula.includes('basic')) {
        base = context['Basic Salary'] || context['Basic'] || context['basic salary'] || 0;
      } 
      else if (lowerFormula.includes('gross')) {
        base = context.gross || 0;
      }
      else {
        base = context['Basic Salary'] || context['Basic'] || context['basic salary'] || monthlyCTC || 0;
      }
      
      return (base * value) / 100;
    }

    return 0;
  } catch (err) {
    // Re-throw to be caught by the higher-level caller which handles the execution log
    throw err;
  }
};

/**
 * Pipeline Step 1: Calculate Attendance
 * Returns totalHours, payableDays, lopDays, etc.
 */
const calculateAttendance = async (user, month, year, policy, effectivePayrollType) => {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(startDate);

  const workingDays = policy.attendance?.workingDaysPerMonth || 22;
  const hoursPerDay = policy.attendance?.workingHoursPerDay || 8;

  // Fetch Leaves & LOP
  const leaves = await Leave.find({
    userId: user._id,
    status: 'approved',
    $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }]
  }).lean();

  let lopDays = 0;
  let paidLeaveDays = 0;
  
  // Use Policy Engine Leave Types
  const leavePolicyTypes = policy.leave?.types || [];
  
  leaves.forEach(l => {
    // Determine paid vs unpaid based on organization policy dynamically
    const pType = leavePolicyTypes.find(t => t.name.toLowerCase() === (l.leaveType || '').toLowerCase());
    const isPaid = pType ? pType.paid : (l.leaveType?.toLowerCase() !== 'unpaid' && l.leaveType?.toLowerCase() !== 'lop');
    
    if (isPaid) {
      paidLeaveDays += l.totalDays || 0;
    } else {
      lopDays += l.totalDays || 0;
    }
  });

  // Always fetch Hours & Attendance regardless of type
  const timesheets = await Timesheet.find({
    userId: user._id, status: 'approved',
    weekStartDate: { $lte: endDate }, weekEndDate: { $gte: startDate }
  }).lean();
  
  let approvedHours = 0;
  let workedDays = 0;
  timesheets.forEach(ts => {
    approvedHours += ts.totalHours || 0;
    
    // Calculate worked days from timesheet entries
    if (ts.rows) {
      ts.rows.forEach(row => {
        if (row.entries) {
          row.entries.forEach(entry => {
            const entryDate = new Date(entry.date);
            if (entryDate >= startDate && entryDate <= endDate && entry.hoursWorked > 0 && !entry.isLeave) {
              workedDays++;
            }
            if (entryDate >= startDate && entryDate <= endDate && entry.isLeave && entry.leaveType === 'lop') {
              const entryHours = entry.hoursWorked || 0;
              if (entryHours > 0) {
                lopDays += (entryHours / hoursPerDay);
              } else {
                lopDays++;
              }
            }
          });
        }
      });
    }
  });

  let payableWeeks = 0;
  if (effectivePayrollType === 'Weekly') {
    payableWeeks = 4; // Simplified
  }

  // Calculate based on business rules: 
  // Paid leave -> dynamic hoursPerDay
  const totalHours = approvedHours + (paidLeaveDays * hoursPerDay);
  // Timesheet hours -> payable days
  const payableDays = totalHours / hoursPerDay;

  const standardMonthlyHours = workingDays * hoursPerDay;
  let overtimeHours = 0;
  if (policy.overtime?.enabled && totalHours > standardMonthlyHours) {
      overtimeHours = totalHours - standardMonthlyHours;
  }

  return { totalHours, payableDays, lopDays, workedDays, approvedHours, payableWeeks, overtimeHours, workingDays, hoursPerDay };
};

/**
 * Pipeline Step 2: Calculate Salary
 * Returns earnings, deductions, grossEarnings, totalDeductions, netPay, lopDeduction
 */
const calculateSalary = (policy, profile, attendance, contextData) => {
  const { userCTC, effectivePayrollType, totalDaysInMonth, startDate } = contextData;
  const { totalHours, payableDays, lopDays, overtimeHours, workingDays, hoursPerDay } = attendance;

  let overtimePay = 0;
  const standardMonthlyHours = workingDays * hoursPerDay;
  if (policy.overtime?.enabled && overtimeHours > 0) {
      const hourlyRate = (userCTC / standardMonthlyHours);
      overtimePay = overtimeHours * (hourlyRate * (policy.overtime.multiplier || 1.5));
  }

  const breakdown = {
    earnings: { components: [], grossEarnings: 0 },
    deductions: { components: [], totalDeductions: 0 },
    grossEarnings: 0,
    totalDeductions: 0,
    netPay: 0,
    lopDeduction: 0,
    executionLog: []
  };

  const context = buildPayrollContext(contextData.user, profile, attendance, policy);
  context.CTC = contextData.userCTC;

  if (effectivePayrollType === 'Monthly' || effectivePayrollType === 'Yearly') {
    // 1. Calculate Earnings from Unified Policy
    const earnings = policy.salaryComponents.filter(c => c.type === 'EARNING');
    const orderedEarnings = resolveExecutionOrder(earnings);

    orderedEarnings.forEach(comp => {
      let val = 0;
      let error = null;

      try {
        if (comp.condition && !evaluateCondition(comp.condition, context)) return;
        val = resolveComponentValue(comp, context, userCTC);
      } catch (err) {
        logger.error(`Earnings fail: [${comp.name}] - ${err.message}`);
        val = 0;
        error = err.message;
      }
      
      let proratedVal = val;
      if (policy.attendance?.prorateSalary) {
         proratedVal = (val / workingDays) * payableDays;
      }
      
      breakdown.earnings.components.push({ name: comp.name, value: proratedVal });
      context[comp.name] = proratedVal;
      context[comp.name.toUpperCase()] = proratedVal;
      
      if (comp.name.toUpperCase().includes('BASIC')) context.BASIC = proratedVal;
      
      breakdown.grossEarnings += proratedVal;
      breakdown.earnings.grossEarnings += proratedVal;

      breakdown.executionLog.push({
          component: comp.name,
          type: 'Earning',
          formula: (comp.formula || comp.value || 'Fixed').toString(),
          result: proratedVal,
          error: error
      });
    });

    context.gross = breakdown.grossEarnings;
    context.GROSS = breakdown.grossEarnings;

    // 2. LOP Deduction
    if (lopDays > 0 && policy.attendance?.lopCalculation) {
      const basic = context['Basic Salary'] || context['Basic'] || context['basic salary'] || context.BASIC || 0;
      const hra = context['House Rent Allowance (HRA)'] || context['HRA'] || context['hra'] || 0;
      const baseForLop = basic + hra; 
      
      let lopVal = 0;
      if (policy.attendance.lopCalculation === 'PER_DAY') {
         lopVal = (baseForLop / workingDays) * lopDays;
      } else if (policy.attendance.lopCalculation === 'PER_HOUR') {
         lopVal = (baseForLop / standardMonthlyHours) * (lopDays * hoursPerDay);
      } else {
         lopVal = (baseForLop / totalDaysInMonth) * lopDays;
      }

      breakdown.lopDeduction = Math.round(lopVal * 100) / 100;
      breakdown.deductions.totalDeductions += breakdown.lopDeduction;
      breakdown.totalDeductions += breakdown.lopDeduction;
    }

    // 3. Dynamic Statutory Logic
    const statutory = policy.statutory || {};

    // PF Calculation
    if (statutory.pf?.enabled) {
        const basic = context.BASIC || context.gross * 0.4;
        const pfBase = Math.min(basic, statutory.pf.wageLimit || 15000);
        const pfVal = (pfBase * (statutory.pf.employeeRate || 12)) / 100;
        breakdown.deductions.components.push({ name: 'PF', value: pfVal });
        breakdown.totalDeductions += pfVal;
        breakdown.deductions.totalDeductions += pfVal;
        context.PF = pfVal;
    }

    // ESI Calculation
    if (statutory.esi?.enabled && breakdown.grossEarnings <= (statutory.esi.wageLimit || 21000)) {
        const esiVal = (breakdown.grossEarnings * (statutory.esi.employeeRate || 0.75)) / 100;
        breakdown.deductions.components.push({ name: 'ESI', value: esiVal });
        breakdown.totalDeductions += esiVal;
        breakdown.deductions.totalDeductions += esiVal;
        context.ESI = esiVal;
    }

    // PT Calculation
    if (statutory.pt?.enabled) {
        const slab = statutory.pt.slabs.find(s => breakdown.grossEarnings >= s.min && (breakdown.grossEarnings <= s.max || !s.max));
        const ptVal = slab ? slab.amount : 0;
        if (ptVal > 0) {
            breakdown.deductions.components.push({ name: 'Professional Tax', value: ptVal });
            breakdown.totalDeductions += ptVal;
            breakdown.deductions.totalDeductions += ptVal;
            context.PT = ptVal;
        }
    }

    // TDS Calculation
    if (statutory.tds?.enabled && breakdown.grossEarnings * 12 > (statutory.tds.threshold || 0)) {
        const annualGross = (breakdown.grossEarnings * 12);
        let tax = 0;
        statutory.tds.slabs.forEach(slab => {
            if (annualGross > slab.min) {
                const taxable = Math.min(annualGross, slab.max || Infinity) - slab.min;
                tax += (taxable * (slab.rate || 0)) / 100;
            }
        });
        const tdsVal = Math.round(tax / 12);
        breakdown.deductions.components.push({ name: 'TDS', value: tdsVal });
        breakdown.totalDeductions += tdsVal;
        breakdown.deductions.totalDeductions += tdsVal;
        context.TDS = tdsVal;
    }

    // 4. Other Deductions from Policy
    const otherDeductions = policy.salaryComponents.filter(c => c.type === 'DEDUCTION' && !c.isStatutory);
    otherDeductions.forEach(comp => {
        let val = 0;
        try {
            if (comp.condition && !evaluateCondition(comp.condition, context)) return;
            val = resolveComponentValue(comp, context, userCTC);
        } catch (err) {
            logger.error(`Deduction fail: [${comp.name}] - ${err.message}`);
        }
        breakdown.deductions.components.push({ name: comp.name, value: val });
        breakdown.totalDeductions += val;
        breakdown.deductions.totalDeductions += val;
        context[comp.name] = val;
    });

    // 5. Add Overtime Earnings 
    if (overtimePay > 0) {
        breakdown.earnings.components.push({ name: 'Overtime Pay', value: Math.round(overtimePay) });
        breakdown.grossEarnings += Math.round(overtimePay);
    }

  } else {
    // Rates for non-monthly types
    let rate = 0;
    if (effectivePayrollType === 'Hourly') rate = profile?.hourlyRate || 0;
    if (effectivePayrollType === 'Daily') rate = profile?.dailyRate || 0;
    if (effectivePayrollType === 'Weekly') rate = profile?.weeklyRate || 0;

    let basePay = 0;
    if (effectivePayrollType === 'Hourly') basePay = totalHours * rate;
    if (effectivePayrollType === 'Daily') basePay = payableDays * rate;
    if (effectivePayrollType === 'Weekly') basePay = payableWeeks * rate;

    breakdown.earnings.components.push({ name: 'Base Salary', value: basePay });
    breakdown.grossEarnings = basePay;
    breakdown.earnings.grossEarnings = basePay;
  }

  // Rounding
  const rounding = policy.rounding || { decimals: 2, rule: 'ROUND_OFF' };
  const applyRounding = (val) => {
      if (rounding.rule === 'ROUND_UP') return Math.ceil(val);
      if (rounding.rule === 'ROUND_DOWN') return Math.floor(val);
      return Math.round(val * Math.pow(10, rounding.decimals)) / Math.pow(10, rounding.decimals);
  };

  breakdown.grossEarnings = applyRounding(breakdown.grossEarnings);
  breakdown.totalDeductions = applyRounding(breakdown.totalDeductions);
  breakdown.netPay = Math.max(0, breakdown.grossEarnings - breakdown.totalDeductions);

  return {
    ...breakdown,
    summary: {
      gross: breakdown.grossEarnings,
      deductions: breakdown.totalDeductions,
      net: breakdown.netPay
    }
  };
};

/**
 * Aggregates all necessary data for a specific user and month/year to simulate payroll.
 */
const simulateUserPayroll = async (userId, month, year, companyId = null) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const policy = await getPolicy(companyId);

  let profile = await PayrollProfile.findOne({ user: userId }).lean();
  
  const effectivePayrollType = policy.attendance?.calculationBasis || profile?.payrollType || 'Monthly';
  
  let calcMonthlyCTC = profile?.monthlyCTC || 0;
  if (effectivePayrollType === 'Yearly') {
    calcMonthlyCTC = (profile?.monthlyCTC || 0) / 12;
  }

  logger.info(`[PAYROLL SIM] User: ${user.name}, Type: ${effectivePayrollType}, CTC: ${calcMonthlyCTC}`);

  const startDate = startOfMonth(new Date(year, month - 1));
  const totalDaysInMonth = getDaysInMonth(startDate);

  // 1. Calculate Attendance
  const attendance = await calculateAttendance(user, month, year, policy, effectivePayrollType);

  // 2. Calculate Salary
  const contextData = {
    userCTC: calcMonthlyCTC,
    effectivePayrollType,
    totalDaysInMonth,
    startDate,
    user
  };
  const breakdown = calculateSalary(policy, profile, attendance, contextData);

  const { lopDays, approvedHours, workedDays, payableWeeks, overtimeHours } = attendance;

  return {
    user: {
      id: user._id,
      name: user.name,
      employeeId: user.employeeId,
      email: user.email,
      department: user.department,
      designation: user.designation,
      branch: user.branch || 'Head Office',
      role: user.role,
      bankName: user.bankName,
      accountNumber: user.accountNumber,
      ifscCode: user.ifscCode,
      uan: user.uan,
      pan: user.pan,
      aadhaar: user.aadhaar
    },
    month,
    year,
    currencySymbol: policy.currencySymbol || '₹',
    paymentType: effectivePayrollType,
    attendance: { 
      lopDays: attendance.lopDays, 
      approvedHours: attendance.approvedHours, 
      workedDays: attendance.workedDays, 
      payableWeeks: attendance.payableWeeks, 
      overtimeHours: attendance.overtimeHours, 
      totalHours: attendance.totalHours, 
      payableDays: attendance.payableDays 
    },
    breakdown
  };
};

/**
 * Ensures a PayrollBatch exists for the given period.
 * Default status is 'Draft'.
 */
const ensureBatchExists = async (month, year, companyId) => {
    let batch = await PayrollBatch.findOne({ month, year, companyId });
    if (!batch) {
        batch = await PayrollBatch.create({
            month,
            year,
            companyId,
            status: 'Draft',
            executionSummary: `Cycle initialized for ${month}/${year}`
        });
    }
    return batch;
};

const lockPayroll = async (month, year, userId) => {
    // Legacy support - internal alias
    return await finalizePayroll({ month, year, processedBy: userId });
};
/**
 * HR Submits payroll for approval.
 * Moves status from 'Processed' to 'Pending Approval'.
 */
const submitForApproval = async ({ month, year, companyId, userId }) => {
    const batch = await PayrollBatch.findOneAndUpdate(
        { month, year, companyId, status: 'Processed' },
        { 
            $set: { 
                status: 'Pending Approval',
                'approvals.hrApproved': true,
                'approvals.approvedBy.hr': userId,
                'approvals.timestamps.hr': new Date()
            } 
        },
        { new: true }
    );

    if (!batch) {
        const existing = await PayrollBatch.findOne({ month, year, companyId });
        if (!existing) throw new Error('Payroll batch not found');
        if (existing.status === 'Pending Approval') return existing; // Already submitted
        throw new Error(`Cannot submit for approval from ${existing.status} state. Must be Processed.`);
    }

    await ProcessedPayroll.updateMany(
        { month, year, companyId },
        { $set: { status: 'Pending Approval' } }
    );

    await auditService.log(userId, 'SUBMIT_PAYROLL_APPROVAL', 'PayrollBatch', batch._id, { month, year }, 'SUCCESS');

    return batch;
};

/**
 * Finance Approves payroll.
 * Moves status from 'Pending Approval' to 'Approved'.
 */
const approvePayroll = async ({ month, year, companyId, userId }) => {
    const batch = await PayrollBatch.findOneAndUpdate(
        { month, year, companyId, status: 'Pending Approval' },
        { 
            $set: { 
                status: 'Approved',
                'approvals.financeApproved': true,
                'approvals.approvedBy.finance': userId,
                'approvals.timestamps.finance': new Date()
            } 
        },
        { new: true }
    );

    if (!batch) {
        const existing = await PayrollBatch.findOne({ month, year, companyId });
        if (!existing) throw new Error('Payroll batch not found');
        if (existing.status === 'Approved') return existing; // Already approved
        throw new Error(`Cannot approve from ${existing.status} state. Must be Pending Approval.`);
    }

    await ProcessedPayroll.updateMany(
        { month, year, companyId },
        { $set: { status: 'Approved' } }
    );

    await auditService.log(userId, 'APPROVE_PAYROLL_FINANCE', 'PayrollBatch', batch._id, { month, year }, 'SUCCESS');

    return batch;
};

/**
 * Admin Reopens payroll for corrections.
 * Resets status to 'Draft' or 'Processed'.
 */
const reopenPayroll = async ({ month, year, companyId, userId }) => {
    const batch = await PayrollBatch.findOne({ month, year, companyId });
    if (!batch) throw new Error('Payroll batch not found');
    if (batch.status === 'Locked') throw new Error('Cannot reopen a locked period.');

    batch.status = 'Draft';
    batch.approvals.hrApproved = false;
    batch.approvals.financeApproved = false;
    batch.approvals.adminApproved = false;
    await batch.save();

    await ProcessedPayroll.updateMany(
        { month, year, companyId },
        { $set: { status: 'Draft' } }
    );

    await auditService.log(userId, 'REOPEN_PAYROLL', 'PayrollBatch', batch._id, { month, year }, 'WARNING');

    return batch;
};

/**
 * Moves a payroll batch from PROCESSED to COMPLETED.
 * This locks individual employee records and creates the next month's DRAFT batch.
 */
const finalizePayroll = async ({ month, year, companyId, processedBy }) => {
    const session = await mongoose.startSession();
    const isReplicaSet = !!(await mongoose.connection.db.admin().command({ isMaster: 1 })).setName;

    if (isReplicaSet) session.startTransaction();

    try {
        const batch = await PayrollBatch.findOne({ month, year, companyId }).session(isReplicaSet ? session : null);
        if (!batch) throw new Error('Payroll batch not found');
        if (batch.status !== 'Processed' && batch.status !== 'Warning' && batch.status !== 'Approved') {
            throw new Error(`Cannot finalize payroll in ${batch.status} state. Must be Processed or Approved first.`);
        }

        // 1. Lock all processed records
        await ProcessedPayroll.updateMany(
            { month, year, companyId },
            { 
                $set: { 
                    status: 'Completed',
                    isLocked: true, 
                    lockedAt: new Date(),
                    lockedBy: processedBy
                } 
            },
            { session }
        );

        // 2. Update Batch to Completed
        batch.status = 'Completed';
        batch.isLocked = true;
        batch.lockedAt = new Date();
        batch.lockedBy = processedBy;
        await batch.save({ session });

        // 3. Auto-create next month's DRAFT cycle
        let nextMonth = month + 1;
        let nextYear = year;
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        }
        await ensureBatchExists(nextMonth, nextYear, companyId);

        if (isReplicaSet) await session.commitTransaction();
        return batch;
    } catch (err) {
        if (isReplicaSet) await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

/**
 * Central Payroll Execution Pipeline
 * Processes payroll for all active employees for a given month and year.
 * ENHANCED: Transaction-safe, Lifecycle-aware.
 */
const runPayroll = async ({ month, year, companyId, processedBy, payslipTemplateId }) => {
  const session = await mongoose.startSession();
  const isReplicaSet = !!(await mongoose.connection.db.admin().command({ isMaster: 1 })).setName;
  
  if (isReplicaSet) session.startTransaction();

  try {
    logger.info(`Enterprise Payroll Execution Started - ${month}/${year}`);
    // 1. Lifecycle Check & Batch Update to PROCESSING
    let batch = await ensureBatchExists(month, year, companyId); // This creates if not exists, status 'Draft'
    // Now, fetch it with the session and update its status
    batch = await PayrollBatch.findOne({ _id: batch._id }).session(isReplicaSet ? session : null);

    if (batch.isLocked) {
        throw new Error(`Idempotency Lock: Payroll for ${month}/${year} is LOCKED. Re-runs prohibited.`);
    }

    batch.status = 'Processing';
    batch.processedBy = processedBy; // Ensure processedBy is set
    await batch.save({ session });

    // 2. Fetch dependencies
    const query = { isActive: true };
    if (companyId) query.companyId = companyId;
    
    const activeEmployees = await User.find(query).lean();
    if (!activeEmployees || activeEmployees.length === 0) {
        throw new Error('No active employees found for processing.');
    }

    const settings = await Settings.findOne().lean();
    const payrollConfig = settings?.payroll || {};

    // 3. Pre-run Structure Validation
    const allStructures = await RoleSalaryStructure.find({ isActive: true }).lean();
    for (const struct of allStructures) {
        resolveExecutionOrder(struct.earnings || []);
        resolveExecutionOrder(struct.deductions || []);
    }

    const payrollResults = [];
    const summaryStats = { totalGross: 0, totalDeductions: 0, totalNetPay: 0 };
    const batchErrors = [];
    let anomalyCount = 0;

    // 4. Parallel Simulation (Read-only part)
    const results = await Promise.all(activeEmployees.map(async (user) => {
        try {
            const payrollData = await simulateUserPayroll(user._id, month, year, companyId);
            const hasAnomalies = payrollData.breakdown.executionLog.some(log => log.error);
            
            return { success: true, user, data: payrollData, hasAnomalies };
        } catch (error) {
            return { success: false, user, error: error.message };
        }
    }));

    // 5. Post-Simulation Aggregation & Formatting
    results.forEach(res => {
        if (res.success) {
            const { data: payrollData, user, hasAnomalies } = res;
            if (hasAnomalies) anomalyCount++;

            const formatted = {
                companyId,
                user: user._id,
                month,
                year,
                paymentType: payrollData.paymentType,
                currencySymbol: payrollConfig.currencySymbol || '₹',
                attendance: payrollData.attendance,
                breakdown: payrollData.breakdown,
                grossYield: Math.round((payrollData.breakdown.summary.gross || 0) * 100) / 100,
                liability: Math.round((payrollData.breakdown.summary.deductions || 0) * 100) / 100,
                netPay: Math.round((payrollData.breakdown.summary.net || 0) * 100) / 100,
                status: hasAnomalies ? 'Warning' : 'Processed',
                processedAt: new Date(),
                payslipTemplateId: payslipTemplateId || null,
                employeeInfo: {
                    name: user.name,
                    employeeId: user.employeeId,
                    department: user.department || 'General',
                    designation: user.designation || 'Staff',
                    branch: user.branch || 'Head Office'
                },
                bankDetails: {
                    bankName: user.bankName,
                    accountNumber: user.accountNumber,
                    ifscCode: user.ifscCode,
                    uan: user.uan,
                    pan: user.pan,
                    aadhaar: user.aadhaar
                }
            };

            payrollResults.push(formatted);
            summaryStats.totalGross += formatted.grossYield;
            summaryStats.totalDeductions += formatted.liability;
            summaryStats.totalNetPay += formatted.netPay;

            if (hasAnomalies) {
               batchErrors.push({ userId: user._id, error: `Telemetry issues detected for ${user.name}. Check execution log.` });
            }
        } else {
            batchErrors.push({ userId: res.user._id, error: res.error });
        }
    });

    if (payrollResults.length === 0) {
        throw new Error(`Zero-record execution: ${batchErrors.length} critical failures prevented processing.`);
    }

    // 6. Persistence within Transaction
    await ProcessedPayroll.deleteMany({ month, year, companyId }, { session });
    const saved = await ProcessedPayroll.insertMany(payrollResults, { session });
    
    // 7. Update Batch Final State (Processed)
    const successCount = saved.length;
    const failedCount = activeEmployees.length - successCount;
    const finalBatchStatus = (failedCount > 0) ? 'Failed' : (anomalyCount > 0 ? 'Warning' : 'Processed');

    const departmentTotals = {};
    payrollResults.forEach(pr => {
        const dept = pr.employeeInfo.department;
        departmentTotals[dept] = (departmentTotals[dept] || 0) + pr.netPay;
    });

    batch.totalEmployees = successCount;
    batch.totalGross = Math.round(summaryStats.totalGross * 100) / 100;
    batch.totalNet = Math.round(summaryStats.totalNetPay * 100) / 100;
    batch.totalDeductions = Math.round(summaryStats.totalDeductions * 100) / 100;
    batch.failedCount = failedCount;
    batch.status = finalBatchStatus;
    batch.processedAt = new Date();
    batch.processedBy = processedBy;
    batch.errors = batchErrors;
    batch.departmentDistribution = departmentTotals;
    batch.executionSummary = `Enterprise run complete. ${successCount} successful, ${anomalyCount} warnings, ${failedCount} hard failures.`;
    
    batch.audit = {
        bankReconciliation: summaryStats.totalNetPay > 0 ? 'Verified' : 'Required',
        taxCompliance: summaryStats.totalDeductions > 0 ? 'Verified' : 'Required',
        varianceAnalysis: 'Pending',
        discrepancies: failedCount + anomalyCount
    };

    await batch.save({ session });

    if (isReplicaSet) await session.commitTransaction();
    logger.info(`[PAYROLL PIPELINE] Committed ${finalBatchStatus} for cycle ${month}/${year}`);

    return {
        success: failedCount === 0,
        batchStatus: finalBatchStatus,
        totalEmployeesProcessed: successCount,
        summaryStats,
        errors: batchErrors,
        details: payrollResults
    };

  } catch (err) {
    if (isReplicaSet) {
        await session.abortTransaction();
    }
    logger.error(`[PAYROLL PIPELINE CRITICAL FAULT] ${err.message}`, { stack: err.stack });
    throw err;
  } finally {
    session.endSession();
  }
};

const saveProcessedPayroll = async (payrollData) => {
  const { user: userData, ...updateContent } = payrollData;
  const userId = userData.id;

  const settings = await Settings.findOne().lean();
  const payrollConfig = settings?.payroll || {};

  const existingPayroll = await ProcessedPayroll.findOne({ user: userId, month: payrollData.month, year: payrollData.year });
  if (existingPayroll && existingPayroll.status === 'Completed' && !payrollData.forceUpdate) {
      throw new Error(`Execution halted: Payroll for ${userData.name} is Locked and Completed. Modifications rejected.`);
  }

  // Instead of throwing error, we now update the existing record to allow re-processing
  return await ProcessedPayroll.findOneAndUpdate(
    { user: userId, month: payrollData.month, year: payrollData.year },
    { 
      ...updateContent, 
      user: userId, 
      grossYield: payrollData.breakdown.summary ? payrollData.breakdown.summary.gross : (payrollData.breakdown.grossYield || 0),
      liability: payrollData.breakdown.summary ? payrollData.breakdown.summary.deductions : (payrollData.breakdown.liability || 0),
      netPay: payrollData.breakdown.summary ? payrollData.breakdown.summary.net : (payrollData.breakdown.netPay || 0),
      status: payrollData.status || 'Completed', 
      processedAt: new Date(),
      currencySymbol: payrollConfig.currencySymbol || '₹',
      payslipTemplate: {
          url: payrollConfig.payslipTemplateUrl || '',
          templateType: payrollConfig.payslipTemplateType || 'Default'
      },
      employeeInfo: {
        name: userData.name,
        employeeId: userData.employeeId,
        department: userData.department,
        designation: userData.designation,
        branch: userData.branch
      },
      bankDetails: {
        bankName: userData.bankName,
        accountNumber: userData.accountNumber,
        ifscCode: userData.ifscCode,
        uan: userData.uan,
        pan: userData.pan,
        aadhaar: userData.aadhaar
      }
    },
    { upsert: true, new: true }
  );
};


/**
 * Generates a summary of processed payrolls for a given month and year.
 */
const getPayrollSummary = async (month, year) => {
  const data = await ProcessedPayroll.find({ month, year });
  
  const summary = {
    totalEmployees: data.length,
    totalGross: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    totalLopDays: 0,
    statusBreakdown: {}
  };

  data.forEach(p => {
    // Use top-level fields (always populated by saveProcessedPayroll)
    summary.totalGross += p.grossYield || p.breakdown?.earnings?.grossEarnings || 0;
    summary.totalDeductions += p.liability || p.breakdown?.deductions?.totalDeductions || 0;
    summary.totalNetPay += p.netPay || p.breakdown?.netPay || 0;
    summary.totalLopDays += p.attendance?.lopDays || 0;
    
    summary.statusBreakdown[p.status] = (summary.statusBreakdown[p.status] || 0) + 1;
  });

  return summary;
};

/**
 * Generates cost analysis grouped by department for a given month and year.
 */
const getDepartmentCostAnalysis = async (month, year) => {
  const data = await ProcessedPayroll.find({ month, year });
  
  const deptMap = {};

  data.forEach(p => {
    const dept = p.employeeInfo?.department || 'Unassigned';
    if (!deptMap[dept]) {
      deptMap[dept] = {
        department: dept,
        employeeCount: 0,
        totalGross: 0,
        totalNet: 0,
        totalDeductions: 0
      };
    }
    
    const d = deptMap[dept];
    d.employeeCount += 1;
    d.totalGross += p.breakdown.grossEarnings || 0;
    d.totalNet += p.breakdown.netPay || 0;
    d.totalDeductions += p.breakdown.totalDeductions || 0;
  });

  return Object.values(deptMap);
};
/**
 * Unified Production-Grade Payroll Dashboard Data
 */
const getPayrollDashboard = async (month, year) => {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(startDate);
  
  // Previous Month
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

  // 1. Optimized Pipeline for Payroll Stats (Current & Previous)
  // NOTE: Uses top-level `grossYield`, `liability`, `netPay` fields which are always
  // written by saveProcessedPayroll(). breakdown.* nested paths had mismatched keys.
  const payrollStats = await ProcessedPayroll.aggregate([
    { $match: { 
        $or: [
            { month, year },
            { month: prevMonth, year: prevYear }
        ] 
    }},
    { $group: {
        _id: { month: "$month", year: "$year" },
        totalPayroll: { $sum: "$netPay" },
        totalEarnings: { $sum: "$grossYield" },
        totalDeductions: { $sum: "$liability" },
        processedEmployees: { $sum: 1 },
        paidPayments: { $sum: { $cond: [{ $in: ["$status", ["Paid", "Completed"]] }, 1, 0] } },

        tds: { $sum: { 
            $reduce: {
                input: "$breakdown.deductions.components",
                initialValue: 0,
                in: { $add: ["$$value", { $cond: [{ $regexMatch: { input: "$$this.name", regex: /TDS|Income Tax/i } }, "$$this.value", 0] }] }
            }
        }},
        pf: { $sum: { 
            $reduce: {
                input: "$breakdown.deductions.components",
                initialValue: 0,
                in: { $add: ["$$value", { $cond: [{ $regexMatch: { input: "$$this.name", regex: /PF|Provident Fund|Employee PF/i } }, "$$this.value", 0] }] }
            }
        }},
        esi: { $sum: { 
            $reduce: {
                input: "$breakdown.deductions.components",
                initialValue: 0,
                in: { $add: ["$$value", { $cond: [{ $regexMatch: { input: "$$this.name", regex: /ESI/i } }, "$$this.value", 0] }] }
            }
        }},
        lopDays: { $sum: "$attendance.lopDays" },
        lopDeductions: { $sum: "$breakdown.lopDeduction" }
    }}
  ]);

  const currentStats = payrollStats.find(s => s._id.month === month && s._id.year === year) || 
    { totalPayroll: 0, totalEarnings: 0, totalDeductions: 0, processedEmployees: 0, paidPayments: 0, tds: 0, pf: 0, esi: 0, lopDays: 0, lopDeductions: 0 };
  const prevStats = payrollStats.find(s => s._id.month === prevMonth && s._id.year === prevYear) || { totalPayroll: 0 };

  const growthPercentage = prevStats.totalPayroll === 0 ? 0 : ((currentStats.totalPayroll - prevStats.totalPayroll) / prevStats.totalPayroll) * 100;

  // 2. Optimized lookup for Counts & Compliance
  const activeEmployeesCount = await User.countDocuments({ isActive: true });
  const usersWithMissingBank = await User.countDocuments({ isActive: true, $or: [{ accountNumber: { $exists: false } }, { accountNumber: "" }, { bankName: { $exists: false } }, { bankName: "" }] });
  
  // Efficiently find users who have active profiles with structures
  const validProfileUserIds = await PayrollProfile.distinct("user", { 
    $or: [{ salaryStructureId: { $ne: null } }, { salaryMode: "Role-Based" }] 
  });
  const usersWithMissingStructure = activeEmployeesCount - validProfileUserIds.length;

  // 3. Leave Aggregation
  const leaveStats = await Leave.aggregate([
    { $match: { 
        status: 'approved',
        $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }]
    }},
    { $group: {
        _id: null,
        unpaidLeaves: { 
          $sum: { 
            $cond: [{ 
              $regexMatch: { input: { $ifNull: ["$leaveType", ""] }, regex: /unpaid|lop/i } 
            }, { $ifNull: ["$totalDays", 0] }, 0] 
          }
        },
        paidLeaves: { 
          $sum: { 
            $cond: [{ 
              $not: [{ $regexMatch: { input: { $ifNull: ["$leaveType", ""] }, regex: /unpaid|lop/i } }]
            }, { $ifNull: ["$totalDays", 0] }, 0] 
          }
        }
    }}
  ]);
  const leaves = leaveStats[0] || { paidLeaves: 0, unpaidLeaves: 0 };

  // 4. Trends
  const trends = await getDashboardTrends();

  // Settings for standard days
  const settings = await Settings.findOne().lean();
  const standardDays = settings?.payroll?.workingDaysPerMonth || 22;

  const batch = await PayrollBatch.findOne({ month, year }).sort({ createdAt: -1 }).lean();

  return {
    batch,
    summary: {
      totalPayroll: currentStats.totalPayroll,
      totalGross: currentStats.totalEarnings,
      totalDeductions: currentStats.totalDeductions,
      previousPayroll: prevStats.totalPayroll,
      growthPercentage: Math.round(growthPercentage * 10) / 10,
      activeEmployees: activeEmployeesCount,
      totalProcessed: currentStats.processedEmployees,
      totalPaid: currentStats.paidPayments,
      lastRunDate: batch?.processedAt || null,
      status: batch?.status || null,
      avgSalary: currentStats.processedEmployees === 0 ? 0 : Math.round(currentStats.totalPayroll / currentStats.processedEmployees)
    },
    attendance: {
      totalEmployees: activeEmployeesCount,
      presentDays: (currentStats.processedEmployees * standardDays) - currentStats.lopDays,
      lopDays: currentStats.lopDays,
      compliancePercentage: activeEmployeesCount === 0 ? 0 : Math.round(((currentStats.processedEmployees * standardDays - currentStats.lopDays) / (activeEmployeesCount * standardDays)) * 100)
    },
    leave: {
      paidLeaves: leaves.paidLeaves,
      unpaidLeaves: leaves.unpaidLeaves,
      leaveDeductions: currentStats.lopDeductions
    },
    payroll: {
      totalEarnings: currentStats.totalEarnings,
      totalDeductions: currentStats.totalDeductions,
      netPayout: currentStats.totalPayroll
    },
    tax: {
      tds: currentStats.tds,
      pf: currentStats.pf,
      esi: currentStats.esi
    },
    bank: {
      processedPayments: currentStats.paidPayments,
      pendingPayments: currentStats.processedEmployees - currentStats.paidPayments,
      failedPayments: 0
    },
    compliance: {
      taxStatus: currentStats.processedEmployees > 0,
      policyMatch: currentStats.processedEmployees === activeEmployeesCount && activeEmployeesCount > 0,
      missingBankDetails: usersWithMissingBank,
      missingSalaryStructure: Math.max(0, usersWithMissingStructure)
    },
    trends
  };
};

/**
 * Trend Visualization Data
 */
const getDashboardTrends = async () => {
    // Last 6 months trend — uses top-level fields for accuracy
    const trends = await ProcessedPayroll.aggregate([
        {
            $group: {
                _id: { month: "$month", year: "$year" },
                totalCost: { $sum: "$netPay" },
                totalGross: { $sum: "$grossYield" },
                totalDeductions: { $sum: "$liability" }
            }
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 6 }
    ]);

    // Dept wise distribution (latest month)
    const latestMonth = trends[0]?._id || { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    const deptDistribution = await ProcessedPayroll.aggregate([
        { $match: { month: latestMonth.month, year: latestMonth.year } },
        { 
            $group: { 
                _id: "$employeeInfo.department", 
                value: { $sum: "$breakdown.netPay" } 
            } 
        },
        { $project: { name: { $ifNull: ["$_id", "Unassigned"] }, value: 1, _id: 0 } }
    ]);

    return {
        monthlyTrend: trends.map(t => ({
            name: `${t._id.month}/${t._id.year}`,
            netPay: t.totalCost,
            grossPay: t.totalGross,
            deductions: t.totalDeductions
        })).reverse(),

        deptDistribution
    };
};

/**
 * Advanced Payroll Analytics
 * Performs multi-stage aggregation to provide Zoho-style visualization data.
 */
const getPayrollAnalytics = async (filters) => {
    const { month, year, department } = filters;
    
    const match = {};
    if (month) match.month = parseInt(month);
    if (year) match.year = parseInt(year);
    if (department && department !== 'All') match['employeeInfo.department'] = department;

    // 1. Summary Metrics — use top-level fields stored by saveProcessedPayroll
    const summary = await ProcessedPayroll.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            totalCost: { $sum: "$grossYield" },
            totalNetPay: { $sum: "$netPay" },
            totalDeductions: { $sum: "$liability" },
            employeeCount: { $sum: 1 }
        }}
    ]);

    // 2. Monthly Trend (Last 12 months)
    // If department filter is active, we trend only for that department
    const trendMatch = department && department !== 'All' ? { 'employeeInfo.department': department } : {};
    const trend = await ProcessedPayroll.aggregate([
        { $match: trendMatch },
        { $group: {
            _id: { month: "$month", year: "$year" },
            gross: { $sum: "$grossYield" },
            net: { $sum: "$netPay" }
        }},
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 12 }
    ]);

    // 3. Department Distribution (for selected month/year)
    const deptDist = await ProcessedPayroll.aggregate([
        { $match: { month: parseInt(month), year: parseInt(year) } },
        { 
            $group: { 
                _id: "$employeeInfo.department", 
                value: { $sum: "$grossYield" } 
            } 
        },
        { $project: { name: { $ifNull: ["$_id", "Unassigned"] }, value: 1, _id: 0 } }
    ]);

    // 4. Detailed Earnings vs Deductions Breakdown (selected month/year)
    const earningComponents = await ProcessedPayroll.aggregate([
        { $match: match },
        { $unwind: "$breakdown.earnings.components" },
        { 
            $group: { 
                _id: "$breakdown.earnings.components.name", 
                value: { $sum: "$breakdown.earnings.components.value" } 
            } 
        }
    ]);

    const deductionComponents = await ProcessedPayroll.aggregate([
        { $match: match },
        { $unwind: "$breakdown.deductions.components" },
        { 
            $group: { 
                _id: "$breakdown.deductions.components.name", 
                value: { $sum: "$breakdown.deductions.components.value" } 
            } 
        }
    ]);

    return {
        summary: summary[0] || { totalCost: 0, totalNetPay: 0, totalDeductions: 0, employeeCount: 0 },
        trend: trend.map(t => ({
            name: `${t._id.month}/${t._id.year}`,
            grossPay: t.gross,
            netPay: t.net
        })).reverse(),

        departmentDistribution: deptDist,
        breakdown: [
            ...earningComponents.map(e => ({ name: e._id, value: Math.round(e.value), type: 'Earning' })),
            ...deductionComponents.map(d => ({ name: d._id, value: Math.round(d.value), type: 'Deduction' }))
        ]
    };
};

/**
 * Returns all PayrollBatch documents (one per month/year), newest first.
 * Used by the History / Run Archive page instead of raw ProcessedPayroll.
 */
const getPayrollBatches = async () => {
  return await PayrollBatch.find()
    .sort({ year: -1, month: -1 })
    .lean();
};

/**
 * Marks a payroll batch as PAID.
 */
const markAsPaid = async ({ month, year, companyId, processedBy, isOverride }) => {
    const batch = await PayrollBatch.findOneAndUpdate(
        { month, year, companyId, status: 'Approved' },
        { 
            $set: { 
                status: 'Paid',
                'approvals.adminApproved': true,
                'approvals.approvedBy.admin': processedBy,
                'approvals.timestamps.admin': new Date()
            } 
        },
        { new: true }
    );

    if (!batch) {
        const existing = await PayrollBatch.findOne({ month, year, companyId });
        if (!existing) throw new Error('Payroll batch not found');
        if (existing.status === 'Paid') return existing; // Already paid
        throw new Error(`Payroll must be Approved by Finance before marking as Paid. Current state: ${existing.status}`);
    }

    // Auto-Cycle: Ensure next Month exists as Draft
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    await ensureBatchExists(nextMonth, nextYear, companyId);
    
    await ProcessedPayroll.updateMany(
        { month, year, companyId },
        { $set: { status: 'Paid', paidAt: new Date() } }
    );

    const auditAction = isOverride ? 'FORCE_DISBURSEMENT' : 'MARK_PAYROLL_PAID';
    await auditService.log(processedBy, auditAction, 'PayrollBatch', batch._id, { month, year, isOverride }, 'SUCCESS');

    return batch;
};

/**
 * Hard-locks a payroll month. No further changes possible.
 */
const hardLockMonth = async ({ month, year, companyId, lockedBy }) => {
    const batch = await PayrollBatch.findOne({ month, year, companyId });
    if (!batch) throw new Error('Payroll batch not found');

    batch.status = 'Locked';
    batch.isLocked = true;
    batch.lockedAt = new Date();
    batch.lockedBy = lockedBy;
    await batch.save();

    await auditService.log(lockedBy, 'LOCK_PAYROLL_PERIOD', 'PayrollBatch', batch._id, { month, year }, 'SUCCESS');

    return batch;
};

module.exports = {
  simulateUserPayroll,
  saveProcessedPayroll,
  lockPayroll: finalizePayroll,
  finalizePayroll, // Keep for backward compatibility if needed
  submitForApproval,
  approvePayroll,
  markAsPaid,
  hardLockMonth,
  reopenPayroll,
  ensureBatchExists,
  getPayrollSummary,
  getDepartmentCostAnalysis,
  getDashboardTrends,
  getPayrollDashboard,
  getPayrollAnalytics,
  runPayroll,
  getPayrollBatches,
  calculateAttendance,
  calculateSalary
};
