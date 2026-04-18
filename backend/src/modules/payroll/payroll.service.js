'use strict';

const { prisma } = require('../../config/database');
const { getPolicy } = require('../policyEngine/policy.service');
const { evaluateFormula, evaluateCondition, buildPayrollContext } = require('../formulaEngine/formula.service');
const { resolveExecutionOrder } = require('../formulaEngine/dependencyResolver');
const { startOfMonth, endOfMonth, getDaysInMonth, format, isWeekend, eachDayOfInterval, isSameDay } = require('date-fns');
const path = require('path');
const logger = require('../../shared/utils/logger');
const auditService = require('../audit/audit.service');
const AppError = require('../../shared/utils/AppError');
const { encrypt, decrypt } = require('../../shared/utils/security');

// Helper to encrypt JSON blobs
const encryptJson = (obj) => (obj && typeof obj === 'object') ? encrypt(JSON.stringify(obj)) : obj;
// Helper to decrypt JSON blobs
const decryptJson = (str) => {
    if (!str || typeof str !== 'string') return str;
    try {
        const decrypted = decrypt(str);
        return decrypted ? JSON.parse(decrypted) : str;
    } catch (e) {
        return str; 
    }
};

const formatProfile = (p) => {
    if (!p) return p;
    return {
        ...p,
        earnings: decryptJson(p.earnings),
        deductions: decryptJson(p.deductions)
    };
};

const formatProcessedPayroll = (p) => {
    if (!p) return p;
    return {
        ...p,
        breakdown: decryptJson(p.breakdown),
        earnings: decryptJson(p.earnings),
        deductions: decryptJson(p.deductions),
        attendance: decryptJson(p.attendance),
        employeeInfo: decryptJson(p.employeeInfo),
        bankDetails: decryptJson(p.bankDetails)
    };
};

const formatPayslip = (p) => {
    if (!p) return p;
    return {
        ...p,
        earnings: decryptJson(p.earnings),
        deductions: decryptJson(p.deductions),
        breakdown: decryptJson(p.breakdown),
        employeeInfo: decryptJson(p.employeeInfo),
        bankDetails: decryptJson(p.bankDetails)
    };
};

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
 * Calculates actual working days in a month/period, excluding weekends and specific holidays.
 * Adjusted for joining dates.
 */
const getWorkingDaysForPeriod = async (month, year, organizationId, employeeId) => {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { joiningDate: true }
  });

  const joiningDate = employee?.joiningDate ? new Date(employee.joiningDate) : null;
  const effectiveStart = (joiningDate && joiningDate > start && joiningDate < end) ? joiningDate : start;

  const holidays = await prisma.holiday.findMany({
    where: {
      organizationId,
      date: { gte: start, lte: end }
    }
  });

  const holidayDates = new Set(holidays.map(h => format(new Date(h.date), 'yyyy-MM-dd')));

  // 1. Calculate Total Org Working Days (Denominator) - ALWAYS needed
  let totalOrgWorkingDaysCount = 0;
  eachDayOfInterval({ start, end }).forEach(day => {
    if (!isWeekend(day) && !holidayDates.has(format(day, 'yyyy-MM-dd'))) {
      totalOrgWorkingDaysCount++;
    }
  });

  // 2. Calculate Individual Adjusted Working Days
  let individualAdjustedWorkingDays = 0;
  
  // Future Joiner Logic: Only calculate if they joined before/during the period
  if (joiningDate && joiningDate > end) {
      individualAdjustedWorkingDays = 0;
  } else {
      eachDayOfInterval({ start: effectiveStart, end }).forEach(day => {
        if (!isWeekend(day) && !holidayDates.has(format(day, 'yyyy-MM-dd'))) {
          individualAdjustedWorkingDays++;
        }
      });
  }

  return {
    totalOrgWorkingDays: totalOrgWorkingDaysCount || 1,
    individualAdjustedWorkingDays: individualAdjustedWorkingDays || 0,
    joiningDate: employee?.joiningDate
  };
};


/**
 * Pipeline Step 1: Calculate Attendance
 * Returns totalHours, payableDays, lopDays, etc.
 */
const calculateAttendance = async (user, month, year, policy, effectivePayrollType, organizationId) => {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(startDate);

  // 1. Get precise working days for this employee (excludes weekends, holidays, and pre-joining days)
  const workingDaysObj = await getWorkingDaysForPeriod(month, year, organizationId, user.employee?.id || user.id);
  const workingDays = workingDaysObj.individualAdjustedWorkingDays;
  const hoursPerDay = policy?.attendance?.workingHoursPerDay || 8;

  // 2. Fetch Approved Leaves
  const leaves = await prisma.leave.findMany({
    where: {
      employeeId: user.employee?.id || user.id,
      organizationId,
      status: 'APPROVED',
      isDeleted: false,
      OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }]
    },
    include: { type: true }
  });

  let lopDays = 0;
  let paidLeaveDays = 0;
  leaves.forEach(l => {
    // If leave type exists and has isDeductible = true, usually means it's a paid leave that deducts from balance
    // For LOP, we'll check name or a specific flag if available. 
    // Defaulting to: If it's not a known paid leave, treat as LOP.
    const typeName = (l.type?.name || '').toLowerCase();
    const isPaid = typeName !== 'unpaid' && typeName !== 'lop' && typeName !== 'loss of pay';
    
    if (isPaid) paidLeaveDays += l.totalDays || 0;
    else lopDays += l.totalDays || 0;
  });

  // 3. Present Days (Payable Days)
  const presentDays = Math.max(0, workingDays - lopDays);

  // 4. Fetch Actual Worked Hours (from Timesheets)
  const timesheetWeeks = await prisma.timesheetWeek.findMany({
    where: {
      userId: user.id,
      status: 'APPROVED',
      organizationId,
      isDeleted: false,
      weekStartDate: { lte: endDate },
      weekEndDate: { gte: startDate }
    }
  });

  let totalHours = 0;
  let actualWorkedDays = 0;
  let totalOvertimeHours = 0;
  const overtimeEnabled = policy?.overtime?.enabled || false;

  timesheetWeeks.forEach(ts => {
    // User Request: "It is five hours but showing only three" 
    // Fix: Attribute the WHOLE week to the month in which it ENDS (weekEndDate).
    // This is common payroll practice ensuring full weeks are paid together.
    const weekEndAt = new Date(ts.weekEndDate);
    const belongsToThisMonth = weekEndAt >= startDate && weekEndAt <= endDate;
    
    if (belongsToThisMonth && Array.isArray(ts.rows)) {
      ts.rows.forEach(row => {
        if (row.entries) {
          row.entries.forEach(entry => {
            const h = parseFloat(entry.hoursWorked) || 0;
            totalHours += h;
            if (h > 0 && !entry.isLeave) actualWorkedDays++;

            // Weekly/Daily Overtime Calculation
            if (overtimeEnabled && !entry.isLeave && h > hoursPerDay) {
              totalOvertimeHours += (h - hoursPerDay);
            }
          });
        }
      });
    }
  });

  return {
    workingDays,
    totalOrgWorkingDays: workingDaysObj.totalOrgWorkingDays,
    joiningDate: workingDaysObj.joiningDate,
    presentDays,
    lopDays,
    paidLeaveDays,
    totalHours,
    overtimeHours: totalOvertimeHours,
    hoursPerDay,
    actualWorkedDays,
    month
  };
};


/**
 * UNIVERSAL PAYROLL CALCULATION ENGINE
 * Rule: Single Source of Truth for all salary computations.
 * Signature: calculateSalaryBreakdown(profile, attendance, policy, month)
 */
const calculateSalaryBreakdown = (profile, attendance, policy, month = new Date().getMonth()) => {
  const processingMonth = month !== undefined ? month : (attendance.month !== undefined ? attendance.month : new Date().getMonth());
  const { 
    workingDays = 1, 
    totalOrgWorkingDays = 1, 
    presentDays = 0, 
    lopDays = 0, 
    overtimeHours = 0, 
    hoursPerDay = 8 
  } = attendance;

  // 1. Engine Configuration (Rounding & Precision)
  const roundingConfig = policy?.rounding || { decimals: 2, rule: 'ROUND_OFF' };
  const applyRounding = (val) => {
    const p = Math.pow(10, roundingConfig.decimals || 2);
      if (roundingConfig.rule === 'ROUND_UP') return Math.ceil(val * p) / p;
    if (roundingConfig.rule === 'ROUND_DOWN') return Math.floor(val * p) / p;
    return Math.round(val * p) / p;
  };

  // 2. Proration Logic (Formula: adjustedSalary = perDaySalary × payableDays)
  // payableDays = presentDays
  // baseSalary / workingDays (standardMonthlyDays)
  const standardMonthlyDays = policy?.attendance?.workingDaysPerMonth || totalOrgWorkingDays;
  // ratio = payableDays / workingDays
  const prorationRatio = standardMonthlyDays > 0 ? (presentDays / standardMonthlyDays) : 0;

  const resolveRawVal = (comp, base) => {
    let val = parseFloat(comp.value) || 0;
    if (comp.calculationType?.toLowerCase() === 'percentage') {
       val = (base * val) / 100;
    }
    return val; 
  };

  const earningsList = (profile.earnings || []).map(e => ({ ...e, name: e.name === 'grativity' ? 'Gratuity' : e.name }));
  const deductionsList = (profile.deductions || []).map(d => ({ ...d, name: d.name === 'grativity' ? 'Gratuity' : d.name }));

  // Stage 1: Base Calculation (Full Month)
  let baseGross = 0;
  const baseBreakdown = {};
  const monthlySalary = (parseFloat(profile.annualCTC) || (parseFloat(profile.monthlyCTC) * 12) || 0) / 12;

  // Pass 1: Independent Earnings
  earningsList.filter(e => !e.basedOn || ['CTC', 'Monthly CTC', 'Annual CTC'].includes(e.basedOn)).forEach(e => {
    const val = resolveRawVal(e, monthlySalary);
    baseBreakdown[e.name] = val;
    baseGross += val;
  });

  // Pass 2: Dependent Earnings
  earningsList.filter(e => e.basedOn && !['CTC', 'Monthly CTC', 'Annual CTC'].includes(e.basedOn)).forEach(e => {
    const base = baseBreakdown[e.basedOn] || 0;
    const val = resolveRawVal(e, base);
    baseBreakdown[e.name] = val;
    baseGross += val;
  });

  // Stage 2: Statutory Logic
  const statutoryDeductions = [];
  const basicSalary = baseBreakdown['Basic Salary'] || baseBreakdown['Basic'] || baseBreakdown['basic salary'] || (baseGross * 0.5);

  if (policy?.statutory?.pf?.enabled) {
    const pf = policy.statutory.pf;
    const pfWageBase = Math.min(basicSalary, pf.wageLimit || 15000);
    const pfAmount = (pfWageBase * (pf.employeeRate || 12)) / 100;
    statutoryDeductions.push({ name: 'Provident Fund (PF)', baseVal: pfAmount, isStatutory: true });
  }

  if (policy?.statutory?.esi?.enabled) {
      const esi = policy.statutory.esi;
      if (baseGross <= (esi.wageLimit || 21000)) {
          const esiAmount = (baseGross * (esi.employeeRate || 0.75)) / 100;
          statutoryDeductions.push({ name: 'ESI', baseVal: esiAmount, isStatutory: true });
      }
  }

  if (policy?.statutory?.pt?.enabled) {
      const pt = policy.statutory.pt;
      // Frequency Logic: MONTHLY (always), HALF_YEARLY/YEARLY (only if match)
      const months = pt.deductionMonths || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const isPaymentMonth = months.includes(processingMonth);

      if (isPaymentMonth || pt.frequency === 'MONTHLY') {
          const slabs = pt.slabs || [];
          const slab = slabs.find(s => baseGross >= s.min && baseGross <= (s.max || 99999999));
          if (slab && slab.amount > 0) {
              statutoryDeductions.push({ name: 'Professional Tax (PT)', baseVal: slab.amount, isStatutory: true, state: pt.state });
          }
      }
  }

  // Gratuity Calculation
  let gratuityProvision = 0;
  let gratuityAccrued = 0;
  if (policy?.statutory?.gratuity?.enabled) {
      const gConfig = policy.statutory.gratuity;
      // Monthly Provision: basic * (15/26) / 12
      gratuityProvision = (basicSalary * (15 / 26)) / 12;
      
      if (gConfig.includeInCTC) {
          statutoryDeductions.push({ name: 'Gratuity', baseVal: gratuityProvision, isStatutory: true });
      }

      // Accrued Gratuity (Informational): basic * tenure * (15/26)
      if (gConfig.showAccrued && attendance.joiningDate) {
          const join = new Date(attendance.joiningDate);
          const now = new Date(); // Using current date for tenure as of today
          const tenureYears = (now - join) / (1000 * 60 * 60 * 24 * 365.25);
          
          if (tenureYears >= 5) {
              gratuityAccrued = basicSalary * tenureYears * (15 / 26);
          }
      }
  }

  // Pass 3: Resolved Base Deductions
  const profileDeductions = deductionsList.filter(d => {
    const name = d.name.toLowerCase();
    const isStatutoryPF = name.includes('provident fund') || name === 'pf';
    const isStatutoryESI = name.includes('esi') || name.includes('state insurance');
    const isStatutoryPT = name.includes('professional tax') || name === 'pt';
    const isStatutoryGratuity = name.includes('gratuity') || name.includes('grativity');

    if (isStatutoryPF && policy?.statutory?.pf?.enabled) return false;
    if (isStatutoryESI && policy?.statutory?.esi?.enabled) return false;
    if (isStatutoryPT && policy?.statutory?.pt?.enabled) return false;
    if (isStatutoryGratuity && policy?.statutory?.gratuity?.enabled) return false;
    return true;
  }).map(d => {
    let base = 0;
    if (d.basedOn === 'Gross') base = baseGross;
    else if (['CTC', 'Monthly CTC'].includes(d.basedOn)) base = monthlySalary;
    else base = baseBreakdown[d.basedOn] || 0;
    return { name: d.name, baseVal: resolveRawVal(d, base) };
  });

  const allDeductionsRaw = [...profileDeductions, ...statutoryDeductions];
  let baseDeductions = 0;
  allDeductionsRaw.forEach(d => baseDeductions += d.baseVal);

  // Stage 3: Attendance-Based Adjustment (Single Source of Truth)
  // Apply proration to EACH component
  const finalEarnings = earningsList.map(e => ({
    name: e.name,
    value: applyRounding((baseBreakdown[e.name] || 0) * prorationRatio)
  }));

  const finalDeductions = allDeductionsRaw.map(d => ({
    name: d.name,
    value: applyRounding(d.baseVal * prorationRatio)
  }));

  // Overtime
  let overtimePay = 0;
  if (overtimeHours > 0 && policy?.overtime?.enabled) {
    const denominator = standardMonthlyDays || 30;
    const hourlyRate = (monthlySalary / denominator) / hoursPerDay;
    const multiplier = policy.overtime.multiplier || 1.5;
    overtimePay = applyRounding(overtimeHours * hourlyRate * multiplier);
    finalEarnings.push({ name: 'Overtime Pay', value: overtimePay, meta: { hours: overtimeHours } });
  }

  const grossPay = applyRounding(baseGross * prorationRatio);
  const totalDeductions = applyRounding(baseDeductions * prorationRatio);
  const netPay = applyRounding(grossPay - totalDeductions + overtimePay);

  return {
    workingDays,
    totalOrgWorkingDays,
    standardMonthlyDays,
    presentDays,
    lopDays,
    overtimeHours,
    overtimePay,
    grossPay,
    totalDeductions,
    netPay,
    netSalary: netPay, // for compatibility
    earnings: finalEarnings,
    deductions: finalDeductions,
    gratuityAccrued: applyRounding(gratuityAccrued),
    gratuityProvision: applyRounding(gratuityProvision),
    lopDeduction: (lopDays > 0 && standardMonthlyDays > 0) ? applyRounding((baseGross / standardMonthlyDays) * lopDays) : 0,
    performanceMetrics: {
        attendancePercentage: standardMonthlyDays > 0 ? (presentDays / standardMonthlyDays) * 100 : 0
    }
  };
};

/**
 * Aggregates all necessary data for a specific user and month/year to simulate payroll.
 */
const simulateUserPayroll = async (userId, month, year, organizationId, options = {}) => {
  const user = await prisma.user.findUnique({
    where: { id_organizationId: { id: userId, organizationId } },
    include: { employee: { include: { payrollProfile: true, department: true, designation: true } } }
  });
  if (!user || user.isDeleted) throw new AppError('User not found', 404);

  const policy = await getPolicy(organizationId);
  const employee = user.employee;
  const profile = formatProfile(employee?.payrollProfile);
  if (!profile) throw new AppError('Payroll profile not configured', 400);

  // Apply runtime overrides (e.g. from UI wizard toggles)
  const effectivePolicy = { ...policy };
  if (options.overtimeEnabled !== undefined) {
      if (!effectivePolicy.overtime) effectivePolicy.overtime = {};
      effectivePolicy.overtime.enabled = !!options.overtimeEnabled;
  }

  // 1. Calculate Attendance using standard logic
  const attendance = await calculateAttendance(user, month, year, effectivePolicy, profile.payrollType || 'Monthly', organizationId);

  // 2. Use Centralized Calculation Engine
  const calculation = calculateSalaryBreakdown(profile, attendance, effectivePolicy, month);


  return {
    user: {
      id: user.id,
      name: user.name,
      employeeId: user.employee?.employeeCode || '-',
      email: user.email,
      department: user.employee?.department?.name || '-',
      designation: user.employee?.designation?.name || '-',
    },
    month,
    year,
    currencySymbol: policy.currencySymbol || '₹',
    attendance,
    ...calculation,
    employeeInfo: {
      name: user.name,
      email: user.email,
      employeeId: user.employee?.employeeCode || '-',
      department: user.employee?.department?.name || '-',
      designation: user.employee?.designation?.name || '-',
      branch: user.employee?.branch || 'Head Office'
    },
    bankDetails: {
      bankName: user.bankName,
      accountNumber: user.accountNumber,
      ifscCode: user.ifscCode,
      uan: user.uan,
      pan: user.pan,
      aadhaar: user.aadhaar
    },
    summary: { // Legacy field mapping for existing frontend expectations
       gross: calculation.grossPay,
       deductions: calculation.totalDeductions,
       net: calculation.netSalary
    }
  };
};

/**
 * Ensures a PayrollBatch exists for the given period.
 * Default status is 'Completed'.
 */
const ensureBatchExists = async (month, year, organizationId) => {
    return await prisma.payrollBatch.upsert({
        where: {
            organizationId_month_year: { organizationId, month, year }
        },
        update: {}, // No update needed if exists
        create: {
            month,
            year,
            organizationId,
            status: 'COMPLETED',
            executionSummary: `Cycle initialized for ${month}/${year}`
        }
    });
};


/**
 * Central Payroll Execution Pipeline
 * Processes payroll for all active employees for a given month and year.
 * ENHANCED: Transaction-safe, Lifecycle-aware.
 */const runPayroll = async ({ month, year, organizationId, processedBy, payslipTemplateId, overtimeEnabled }) => {
  try {
    logger.info(`Enterprise Payroll Execution Started - ${month}/${year}`);

    // Standardize batch
    let batch = await ensureBatchExists(month, year, organizationId);

    // Fetch dependencies
    const activeEmployees = await prisma.user.findMany({
      where: {
        isActive: true,
        organizationId,
        isDeleted: false
      },
      include: {
        employee: {
          include: {
            payrollProfile: true,
            department: true,
            designation: true
          }
        }
      }
    });

    if (!activeEmployees || activeEmployees.length === 0) {
      throw new AppError('No active employees found for processing.', 404);
    }

    // Safety: Find already paid records to skip
    const paidRecords = await prisma.processedPayroll.findMany({
      where: { month, year, organizationId, isPaid: true },
      select: { employeeId: true }
    });
    const paidEmployeeIds = new Set(paidRecords.map(r => r.employeeId));

    const employeesToProcess = activeEmployees.filter(u => {
      if (u.employee?.payrollProfile) {
        u.employee.payrollProfile = formatProfile(u.employee.payrollProfile);
      }
      return u.employee?.payrollProfile && !paidEmployeeIds.has(u.employee.id);
    });

    if (employeesToProcess.length === 0) {
      await prisma.payrollBatch.update({
        where: { id: batch.id },
        data: { status: 'COMPLETED' }
      });
      return { success: true, message: 'All active employees for this period are already paid.', details: [] };
    }

    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
    const payrollConfig = orgSettings?.data?.payroll || {};

    const payrollResults = [];
    const summaryStats = { totalGross: 0, totalDeductions: 0, totalNetPay: 0 };
    const batchErrors = [];
    let anomalyCount = 0;

    // Parallel Simulation
    const results = await Promise.all(employeesToProcess.map(async (user) => {
      try {
        const payrollData = await simulateUserPayroll(user.id, month, year, organizationId, { overtimeEnabled });
        return { success: true, user, data: payrollData };
      } catch (error) {
        return { success: false, user, error: error.message };
      }
    }));

    // Post-Simulation Aggregation
    results.forEach(res => {
      if (res.success) {
        const { data: payrollData, user } = res;

        const formatted = {
          organizationId,
          employeeId: user.employee.id,
          payrollBatchId: batch.id,
          month,
          year,
          paymentType: payrollData.paymentType || 'Bank Transfer',
          currencySymbol: payrollData.currencySymbol || '₹',
          attendance: encryptJson(payrollData.attendance),
          breakdown: encryptJson(payrollData), 
          earnings: encryptJson(payrollData.earnings || []),
          deductions: encryptJson(payrollData.deductions || []),
          grossYield: parseFloat(payrollData.grossPay) || 0,
          liability: parseFloat(payrollData.totalDeductions) || 0,
          netPay: parseFloat(payrollData.netSalary) || 0,
          profileVersion: payrollData.profileVersion || 1,
          isPaid: false,
          processedAt: new Date(),
          payslipTemplateId: payslipTemplateId || null,
          employeeInfo: encryptJson({
            name: user.name,
            email: user.email,
            employeeId: user.employee?.employeeCode || '-',
            department: user.employee?.department?.name || '-',
            designation: user.employee?.designation?.name || '-',
            joiningDate: user.employee?.joiningDate,
            branch: user.employee?.branch || 'Head Office'
          }),
          bankDetails: encryptJson({
            bankName: decrypt(user.bankName),
            accountNumber: decrypt(user.accountNumber),
            ifscCode: decrypt(user.ifscCode),
            uan: decrypt(user.uan),
            pan: decrypt(user.pan),
            aadhaar: decrypt(user.aadhaar)
          })
        };

        payrollResults.push(formatted);
        summaryStats.totalGross += formatted.grossYield;
        summaryStats.totalDeductions += formatted.liability;
        summaryStats.totalNetPay += formatted.netPay;
      } else {
        batchErrors.push({ userId: res.user.id, error: res.error });
      }
    });


    if (payrollResults.length === 0) {
      throw new AppError(`Zero-record execution: ${batchErrors.length} critical failures prevented processing.`, 400);
    }

    // Transaction Persistence
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Delete non-paid records for this cycle
      await tx.processedPayroll.deleteMany({
        where: { month, year, organizationId, isPaid: false }
      });

      // 2. Create new records (Bulk)
      await tx.processedPayroll.createMany({
        data: payrollResults
      });

      // 3. Update Batch
      const departmentTotals = {};
      payrollResults.forEach(pr => {
        const dept = pr.employeeInfo.department;
        departmentTotals[dept] = (departmentTotals[dept] || 0) + pr.netPay;
      });

      const updatedBatch = await tx.payrollBatch.update({
        where: { id: batch.id },
        data: {
          totalEmployees: payrollResults.length + paidEmployeeIds.size,
          totalGross: Math.round(summaryStats.totalGross * 100) / 100,
          totalNet: Math.round(summaryStats.totalNetPay * 100) / 100,
          totalDeductions: Math.round(summaryStats.totalDeductions * 100) / 100,
          failedCount: batchErrors.length,
          status: batchErrors.length > 0 ? 'ERROR' : 'COMPLETED',
          processedAt: new Date(),
          processedBy,
          errors: batchErrors,
          departmentDistribution: departmentTotals,
          executionSummary: `Enterprise run complete. ${payrollResults.length} successful, ${anomalyCount} warnings. ${paidEmployeeIds.size} skipped.`,
          organizationId
        }
      });

      // 4. Immutable Audit Ledger
      await tx.payrollLedger.create({
        data: {
          organizationId,
          action: 'PAYROLL_RUN',
          batchId: batch.id,
          performedBy: processedBy,
          metadata: {
            employees: payrollResults.length,
            totalNet: summaryStats.totalNetPay,
            errors: batchErrors.length
          }
        }
      });

      return updatedBatch;
    });

    logger.info(`[PAYROLL PIPELINE] Committed for cycle ${month}/${year}`);

    return {
      success: batchErrors.length === 0,
      batchStatus: transaction.status,
      successCount: payrollResults.length,
      failedCount: batchErrors.length,
      totalEmployeesProcessed: payrollResults.length,
      summaryStats,
      errors: batchErrors,
      details: payrollResults
    };

  } catch (err) {
    logger.error(`[PAYROLL PIPELINE CRITICAL FAULT] ${err.message}`, { stack: err.stack });
    throw err;
  }
};

const saveProcessedPayroll = async (payrollData, organizationId) => {
  const { user: userData, attendance, breakdown, month, year, paymentType, currencySymbol, profileVersion, payslipTemplateId } = payrollData;
  const userId = userData.id;

  // Resolve employeeId from userId if not provided correctly
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  });
  if (!user || !user.employee) throw new AppError('Employee profile not found.', 404);

  const existingPayroll = await prisma.processedPayroll.findFirst({
    where: { 
      employeeId: user.employee.id, 
      month, 
      year, 
      organizationId 
    }
  });
  
  if (existingPayroll && existingPayroll.isPaid) {
      throw new AppError(`Execution halted: Payroll for ${userData.name} is ALREADY PAID. Modifications prohibited.`, 400);
  }

  // Standardized fields for Prisma
  const processedData = {
    organizationId,
    employeeId: user.employee.id,
    payrollBatchId: payrollData.payrollBatchId || (await ensureBatchExists(month, year, organizationId)).id,
    month,
    year,
    paymentType: paymentType || 'Monthly',
    currencySymbol: currencySymbol || '₹',
    attendance: attendance || {},
    breakdown: payrollData, 
    earnings: Array.isArray(payrollData.earnings) ? payrollData.earnings : [],
    deductions: Array.isArray(payrollData.deductions) ? payrollData.deductions : [],
    grossYield: parseFloat(payrollData.grossPay) || 0,
    liability: parseFloat(payrollData.totalDeductions) || 0,
    netPay: parseFloat(payrollData.netSalary) || 0,
    isPaid: false,
    profileVersion: profileVersion || 1,
    payslipTemplateId: payslipTemplateId || null,
    employeeInfo: {
      name: userData.name,
      employeeId: user.employee.employeeCode,
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
  };

  return await prisma.processedPayroll.upsert({
    where: {
      payrollBatchId_employeeId: {
        payrollBatchId: processedData.payrollBatchId,
        employeeId: processedData.employeeId
      }
    },
    update: processedData,
    create: processedData
  });
};


/**
 * Generates a summary of processed payrolls for a given month and year.
 */
const getPayrollSummary = async (month, year, organizationId) => {
  const data = await prisma.processedPayroll.findMany({
    where: { month, year, organizationId }
  });
  
  const summary = {
    totalEmployees: data.length,
    totalGross: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    totalLopDays: 0,
    statusBreakdown: {}
  };

  data.forEach(p => {
    summary.totalGross += p.grossYield || 0;
    summary.totalDeductions += p.liability || 0;
    summary.totalNetPay += p.netPay || 0;
    summary.totalLopDays += p.attendance?.lopDays || 0;
    
    const status = p.isPaid ? 'PAID' : 'PENDING';
    summary.statusBreakdown[status] = (summary.statusBreakdown[status] || 0) + 1;
  });

  return summary;
};

/**
 * Generates cost analysis grouped by department for a given month and year.
 */
const getDepartmentCostAnalysis = async (month, year, organizationId) => {
  const data = await prisma.processedPayroll.findMany({
    where: { month: parseInt(month), year: parseInt(year), organizationId }
  });
  
  const deptMap = {};

  data.forEach(p => {
    const info = p.employeeInfo;
    const dept = info?.department || 'Unassigned';
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
    d.totalGross += p.grossYield || 0;
    d.totalNet += p.netPay || 0;
    d.totalDeductions += p.liability || 0;
  });

  return Object.values(deptMap);
};
/**
 * Unified Production-Grade Payroll Dashboard Data
 */
const getPayrollDashboard = async (month, year, organizationId) => {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(startDate);
  
  // Previous Month
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

  // 1. Fetch current and previous month records for Comparison
  const payrolls = await prisma.processedPayroll.findMany({
    where: {
      organizationId,
      OR: [
        { month, year },
        { month: prevMonth, year: prevYear }
      ]
    }
  });

  const getStats = (m, y) => {
    const filtered = payrolls.filter(p => p.month === m && p.year === y);
    const stats = {
      totalPayroll: 0, totalEarnings: 0, totalDeductions: 0, 
      processedEmployees: filtered.length, paidPayments: 0, 
      tds: 0, pf: 0, esi: 0, lopDays: 0, lopDeductions: 0
    };

    filtered.forEach(p => {
      stats.totalPayroll += p.netPay;
      stats.totalEarnings += p.grossYield;
      stats.totalDeductions += p.liability;
      if (p.isPaid) stats.paidPayments++;
      
      const att = p.attendance;
      stats.lopDays += att?.lopDays || 0;

      const bd = p.breakdown;
      stats.lopDeductions += bd?.lopDeduction || 0;

      // Extract statutory values from components
      const deds = bd?.deductions?.components || [];
      deds.forEach(d => {
        if (/TDS|Income Tax/i.test(d.name)) stats.tds += d.value;
        if (/PF|Provident Fund|Employee PF/i.test(d.name)) stats.pf += d.value;
        if (/ESI/i.test(d.name)) stats.esi += d.value;
      });
    });
    return stats;
  };

  const currentStats = getStats(month, year);
  const prevStats = getStats(prevMonth, prevYear);

  const growthPercentage = prevStats.totalPayroll === 0 ? 0 : ((currentStats.totalPayroll - prevStats.totalPayroll) / prevStats.totalPayroll) * 100;

  // 2. Optimized lookup for Counts
  const activeEmployeesCount = await prisma.user.count({ where: { isActive: true, organizationId, isDeleted: false } });
  const usersWithMissingBank = await prisma.user.count({ 
    where: { 
      isActive: true, organizationId, isDeleted: false,
      OR: [
        { accountNumber: null }, { accountNumber: "" },
        { bankName: null }, { bankName: "" }
      ]
    } 
  });
  
  const usersWithStructure = await prisma.payrollProfile.count({
    where: { 
      organizationId, 
      OR: [
        { NOT: { salaryStructureId: null } },
        { annualCTC: { gt: 0 } }
      ]
    }
  });
  const usersWithMissingStructure = activeEmployeesCount - usersWithStructure;

  // 3. Leave Aggregation
  const leavesInMonth = await prisma.leave.findMany({
    where: {
      organizationId,
      status: 'APPROVED',
      OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }]
    }
  });

  let paidLeaves = 0;
  let unpaidLeaves = 0;
  leavesInMonth.forEach(l => {
    const isUnpaid = /unpaid|lop/i.test(l.reason || ''); // fallback check
    if (isUnpaid) unpaidLeaves += l.totalDays || 0;
    else paidLeaves += l.totalDays || 0;
  });

  // 4. Trends
  const trends = await getDashboardTrends(organizationId);

  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const standardDays = settings?.data?.payroll?.workingDaysPerMonth || 22;

  const batch = await prisma.payrollBatch.findFirst({
    where: { month, year, organizationId },
    orderBy: { createdAt: 'desc' }
  });

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
      paidLeaves,
      unpaidLeaves,
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
const getDashboardTrends = async (organizationId) => {
   const payrolls = await prisma.processedPayroll.findMany({
       where: { organizationId },
       orderBy: [{ year: 'desc' }, { month: 'desc' }],
       take: 12
   });

   const trendMap = {};
   payrolls.forEach(p => {
       const key = `${p.month}/${p.year}`;
       if (!trendMap[key]) {
           trendMap[key] = { name: key, netPay: 0, grossPay: 0, deductions: 0, sortKey: p.year * 100 + p.month };
       }
       trendMap[key].netPay += p.netPay;
       trendMap[key].grossPay += p.grossYield;
       trendMap[key].deductions += p.liability;
   });

   const monthlyTrend = Object.values(trendMap)
       .sort((a, b) => a.sortKey - b.sortKey)
       .slice(-6);

   // Dept wise distribution (latest month)
   const latest = payrolls[0];
   const deptDistribution = [];
   if (latest) {
       const latestMonthPayrolls = payrolls.filter(p => p.month === latest.month && p.year === latest.year);
       const depts = {};
       latestMonthPayrolls.forEach(p => {
           const info = p.employeeInfo;
           const d = info?.department || 'Unassigned';
           depts[d] = (depts[d] || 0) + p.netPay;
       });
       Object.keys(depts).forEach(name => {
           deptDistribution.push({ name, value: depts[name] });
       });
   }

   return { monthlyTrend, deptDistribution };
};

/**
 * Advanced Payroll Analytics
 * Performs multi-stage aggregation to provide Zoho-style visualization data.
 */
const getPayrollAnalytics = async (filters) => {
    const { month, year, department, organizationId } = filters;
    const m = month ? parseInt(month) : null;
    const y = year ? parseInt(year) : null;

    const where = { organizationId };
    if (m) where.month = m;
    if (y) where.year = y;

    const records = await prisma.processedPayroll.findMany({ where });
    const filtered = department && department !== 'All' 
        ? records.filter(p => p.employeeInfo?.department === department)
        : records;

    const summary = {
        totalCost: 0, totalNetPay: 0, totalDeductions: 0, employeeCount: filtered.length
    };
    filtered.forEach(p => {
        summary.totalCost += p.grossYield;
        summary.totalNetPay += p.netPay;
        summary.totalDeductions += p.liability;
    });

    // 2. Monthly Trend (Last 12 months)
    const allRecords = await prisma.processedPayroll.findMany({ 
        where: { organizationId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1000 // reasonable limit
    });
    const trendFiltered = department && department !== 'All' 
        ? allRecords.filter(p => p.employeeInfo?.department === department)
        : allRecords;
    
    const trendMap = {};
    trendFiltered.forEach(p => {
        const key = `${p.month}/${p.year}`;
        if (!trendMap[key]) trendMap[key] = { name: key, grossPay: 0, netPay: 0, sortKey: p.year * 100 + p.month };
        trendMap[key].grossPay += p.grossYield;
        trendMap[key].netPay += p.netPay;
    });
    const trend = Object.values(trendMap)
        .sort((a, b) => a.sortKey - b.sortKey)
        .slice(-12);

    // 3. Dept Distribution (current selection)
    const deptMap = {};
    filtered.forEach(p => {
        const d = p.employeeInfo?.department || 'Unassigned';
        deptMap[d] = (deptMap[d] || 0) + p.grossYield;
    });
    const departmentDistribution = Object.keys(deptMap).map(name => ({ name, value: deptMap[name] }));

    // 4. Detailed Breakdown
    const earningsMap = {};
    const deductionsMap = {};
    filtered.forEach(p => {
        const bd = p.breakdown;
        (Array.isArray(bd?.earnings) ? bd.earnings : bd?.earnings?.components || []).forEach(c => {
            earningsMap[c.name] = (earningsMap[c.name] || 0) + (parseFloat(c.value) || 0);
        });
        (Array.isArray(bd?.deductions) ? bd.deductions : bd?.deductions?.components || []).forEach(c => {
            deductionsMap[c.name] = (deductionsMap[c.name] || 0) + (parseFloat(c.value) || 0);
        });
    });

    const breakdown = [
        ...Object.keys(earningsMap).map(name => ({ name, value: Math.round(earningsMap[name]), type: 'Earning' })),
        ...Object.keys(deductionsMap).map(name => ({ name, value: Math.round(deductionsMap[name]), type: 'Deduction' }))
    ];

    return { summary, trend, departmentDistribution, breakdown };
};

/**
 * Returns all PayrollBatch documents (one per month/year), newest first.
 * Used by the History / Run Archive page instead of raw ProcessedPayroll.
 */
const getPayrollBatches = async (organizationId) => {
  return await prisma.payrollBatch.findMany({
    where: { organizationId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  });
};

/**
 * Marks a payroll batch as PAID.
 */
const markAsPaid = async ({ month, year, organizationId, processedBy }) => {
    const batch = await prisma.payrollBatch.findFirst({
        where: { month, year, organizationId, isDeleted: false }
    });
    if (!batch) throw new AppError('Payroll batch not found', 404);
    if (batch.isPaid) throw new AppError('Payroll batch is already paid', 400);

    // Update using atomic transaction
    const updatedBatch = await prisma.$transaction(async (tx) => {
        const uBatch = await tx.payrollBatch.update({
            where: { id_organizationId: { id: batch.id, organizationId } },
            data: { 
                isPaid: true,
                paidAt: new Date(),
                paidBy: processedBy,
                status: 'PAID'
            }
        });

        await tx.processedPayroll.updateMany({
            where: { month, year, organizationId, isPaid: false },
            data: { 
                isPaid: true, 
                paidAt: new Date(),
                paidBy: processedBy
            }
        });

        // Also update any generated payslips in the new lifecycle
        await tx.payslip.updateMany({
            where: { month, year, organizationId, status: { in: ['GENERATED', 'SENT'] } },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paidBy: processedBy
            }
        });

        await tx.payrollLedger.create({
            data: {
                organizationId,
                action: 'PAYROLL_MARK_PAID',
                batchId: batch.id,
                performedBy: processedBy,
                metadata: { month, year, totalNet: batch.totalNet }
            }
        });

        return uBatch;
    });

    await auditService.logAction({ 
        userId: processedBy, 
        action: 'MARK_PAYROLL_PAID', 
        entityType: 'PayrollBatch', 
        entityId: batch.id, 
        details: { month, year },
        organizationId 
    }).catch(() => {});

    return updatedBatch;
};

/**
 * Upserts a full payroll profile including earnings, deductions, ctc, and bank details.
 * Implements locking if payroll is already processed for the month.
 */
const upsertFullPayrollProfile = async (data, organizationId, performerId) => {
    const { employeeId, annualCTC, earnings, deductions, bankDetails } = data;

    // 1. Check for Active Payroll Lock
    // If a payroll run exists for the CURRENT month/year and is PROCESSING it's locked.
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const activeBatch = await prisma.payrollBatch.findFirst({
        where: { organizationId, month, year, status: 'PROCESSING' }
    });

    if (activeBatch) {
        throw new AppError('Payroll profile is currently locked as a payroll run is in progress for this month.', 400);
    }

    return await prisma.$transaction(async (tx) => {
        // 2. Upsert Payroll Profile
        const profile = await tx.payrollProfile.upsert({
            where: { employeeId },
            update: {
                annualCTC: parseFloat(annualCTC),
                monthlyCTC: parseFloat(annualCTC) / 12,
                earnings: encryptJson(earnings) || [],
                deductions: encryptJson(deductions) || [],
                profileVersion: { increment: 1 },
                organizationId
            },
            create: {
                employeeId,
                organizationId,
                annualCTC: parseFloat(annualCTC),
                monthlyCTC: parseFloat(annualCTC) / 12,
                earnings: encryptJson(earnings) || [],
                deductions: encryptJson(deductions) || [],
                profileVersion: 1
            }
        });

        // 3. Fetch employee to link bank updates & return data
        const employee = await tx.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, userId: true }
        });

        if (!employee) throw new AppError('Employee record not found', 404);

        if (bankDetails) {
            if (employee.userId) {
                const bankUpdate = {};
                if (bankDetails.bankName) bankUpdate.bankName = bankDetails.bankName;
                if (bankDetails.accountNumber) bankUpdate.accountNumber = bankDetails.accountNumber;
                if (bankDetails.ifscCode) bankUpdate.ifscCode = bankDetails.ifscCode;
                if (bankDetails.pan) bankUpdate.pan = bankDetails.pan;
                if (bankDetails.uan) bankUpdate.uan = bankDetails.uan;

                if (Object.keys(bankUpdate).length > 0) {
                    await tx.user.update({
                        where: { id: employee.userId },
                        data: bankUpdate
                    });
                }
            }
        }

        await auditService.log(performerId, 'PAYROLL_PROFILE_SETUP', 'PayrollProfile', profile.id, data, 'SUCCESS', null, organizationId);
        
        // Fetch updated user to return
        const updatedUser = await tx.user.findUnique({
            where: { id: employee.userId },
            include: { employee: { include: { payrollProfile: true } } }
        });

        return { profile: formatProfile(profile), user: updatedUser };
    });
};

/**
 * Checks system readiness for a month/year payroll cycle.
 * Returns counts of ready, missing bank, and missing profile employees.
 */
const getReadinessCheck = async (organizationId, month, year) => {
    const activeEmployees = await prisma.user.findMany({
        where: { organizationId, isActive: true, isDeleted: false },
        include: { employee: { include: { payrollProfile: true } } }
    });

    const summary = {
        totalEmployees: activeEmployees.length,
        readyCount: 0,
        missingProfileCount: 0,
        missingBankCount: 0,
        readyEmployees: []
    };

    activeEmployees.forEach(u => {
        const hasProfile = !!u.employee?.payrollProfile;
        const hasBank = !!(u.bankName && u.accountNumber);

        if (!hasProfile) summary.missingProfileCount++;
        else if (!hasBank) summary.missingBankCount++;
        else {
            summary.readyCount++;
            summary.readyEmployees.push({
                id: u.id,
                name: u.name,
                employeeId: u.employee.employeeCode,
                department: u.employee.department?.name || 'Unassigned'
            });
        }
    });

    return { summary };
};

/**
 * Generates a full payroll simulation preview for all "ready" employees.
 */
const getPayrollPreview = async (organizationId, month, year, overtimeEnabled) => {
    const readiness = await getReadinessCheck(organizationId, month, year);
    const readyEmployees = readiness.summary.readyEmployees;

    const simulations = await Promise.all(readyEmployees.map(async (emp) => {
        try {
            const sim = await simulateUserPayroll(emp.id, parseInt(month), parseInt(year), organizationId, { overtimeEnabled });
            return {
                id: emp.id,
                name: emp.name,
                employeeId: emp.employeeId || '-',
                joiningDate: sim.joiningDate,
                totalOrgWorkingDays: sim.totalOrgWorkingDays,
                baseGross: sim.baseGross,
                adjustedGross: sim.adjustedGross,
                adjustedDeductions: sim.adjustedDeductions,
                gross: sim.grossPay,
                deductions: sim.totalDeductions,
                net: sim.netSalary,
                standardMonthlyDays: sim.standardMonthlyDays,
                working: sim.workingDays,
                present: sim.presentDays,
                lop: sim.lopDays,
                overtimeHours: sim.overtimeHours,
                overtimePay: sim.overtimePay,
                status: 'READY'
            };
        } catch (err) {
            return {
                id: emp.id,
                name: emp.name,
                employeeId: emp.employeeId,
                error: err.message,
                status: 'ERROR'
            };
        }
    }));

    const summary = {
        totalEmployees: simulations.length,
        totalGross: simulations.reduce((acc, s) => acc + (s.gross || 0), 0),
        totalDeductions: simulations.reduce((acc, s) => acc + (s.deductions || 0), 0),
        totalNetPay: simulations.reduce((acc, s) => acc + (s.net || 0), 0),
        errorCount: simulations.filter(s => s.status === 'ERROR').length
    };

    return { summary, breakdown: simulations };
};

/**
 * Generates immutable Payslip records from ProcessedPayroll calculations.
 */
const generatePayslips = async (month, year, organizationId, generatedBy) => {
    const processedPayrolls = await prisma.processedPayroll.findMany({
        where: { month: parseInt(month), year: parseInt(year), organizationId, isDeleted: false }
    });

    if (!processedPayrolls.length) {
        throw new AppError('No finalized payroll calculations found for the selected period. Please "Run Payroll" first.', 404);
    }

    const results = [];
    for (let record of processedPayrolls) {
        record = formatProcessedPayroll(record);
        const breakdown = record.breakdown || {};
        
        const payslipData = {
            netSalary: record.netPay, 
            netPay: record.netPay,
            gross: record.grossYield,
            totalDeductions: record.liability,
            earnings: encryptJson(Array.isArray(breakdown.earnings) ? breakdown.earnings : (breakdown.earnings?.components || [])),
            deductions: encryptJson(Array.isArray(breakdown.deductions) ? breakdown.deductions : (breakdown.deductions?.components || [])),
            breakdown: encryptJson(record.breakdown),
            employeeInfo: encryptJson(record.employeeInfo),
            bankDetails: encryptJson(record.bankDetails),
            updatedAt: new Date(),
            generatedBy
        };

        const payslip = await prisma.payslip.upsert({
            where: {
                organizationId_month_year_employeeId: {
                    organizationId,
                    month: parseInt(month),
                    year: parseInt(year),
                    employeeId: record.employeeId
                }
            },
            update: payslipData,
            create: {
                ...payslipData,
                organizationId,
                employeeId: record.employeeId,
                processedPayrollId: record.id,
                month: parseInt(month),
                year: parseInt(year),
                status: 'GENERATED'
            }
        });
        results.push(payslip);
    }

    const batchId = processedPayrolls[0].payrollBatchId;

    await prisma.payrollLedger.create({
        data: {
            organizationId,
            action: 'PAYSLIP_GENERATION',
            batchId,
            performedBy: generatedBy,
            metadata: { month, year, count: results.length }
        }
    });

    return results;
};

/**
 * Marks a single Payslip record as PAID.
 * Guards: throws if not found, or already PAID/SENT.
 */
const markPayslipAsPaid = async (id, organizationId, paidBy) => {
    const payslip = await prisma.payslip.findFirst({
        where: { id, organizationId, isDeleted: false }
    });
    if (!payslip) throw new AppError('Payslip not found.', 404);

    const updated = await prisma.payslip.update({
        where: { id },
        data: {
            status: 'PAID',
            paidAt: payslip.paidAt || new Date(),
            paidBy: payslip.paidBy || paidBy
        }
    });

    // CRITICAL: Always sync with ProcessedPayroll to ensure Dashboard reflects payment
    // This also fixes records that were marked as paid before the sync logic was added.
    await prisma.processedPayroll.updateMany({
        where: { 
            employeeId: payslip.employeeId, 
            month: payslip.month, 
            year: payslip.year,
            organizationId 
        },
        data: {
            isPaid: true,
            paidAt: payslip.paidAt || new Date(),
            paidBy: payslip.paidBy || paidBy
        }
    });

    await prisma.payrollLedger.create({
        data: {
            organizationId,
            action: 'PAYSLIP_MARKED_PAID',
            performedBy: paidBy,
            metadata: { payslipId: id, employeeId: payslip.employeeId, month: payslip.month, year: payslip.year }
        }
    }).catch(() => {});

    // SYNC: Auto-calculate if entire Batch is now complete
    const currentProcessed = await prisma.processedPayroll.findUnique({
        where: { id: payslip.processedPayrollId }
    });

    if (currentProcessed?.payrollBatchId) {
        const unpaidCount = await prisma.processedPayroll.count({
            where: { 
                payrollBatchId: currentProcessed.payrollBatchId, 
                isPaid: false,
                isDeleted: false 
            }
        });

        if (unpaidCount === 0) {
            await prisma.payrollBatch.update({
                where: { id: currentProcessed.payrollBatchId },
                data: { 
                    isPaid: true, 
                    status: 'PAID', 
                    paidAt: payslip.paidAt || new Date(), 
                    paidBy 
                }
            }).catch(() => {});
        }
    }

    return updated;
};

/**
 * Marks multiple Payslip records as PAID in bulk.
 */
const bulkMarkPayslipsAsPaid = async (ids, organizationId, paidBy) => {
    const results = { success: 0, failed: 0, errors: [] };

    for (const id of ids) {
        try {
            await markPayslipAsPaid(id, organizationId, paidBy);
            results.success++;
        } catch (err) {
            results.failed++;
            results.errors.push({ id, error: err.message });
        }
    }

    await auditService.log(
        paidBy, 'BULK_MARK_PAYSLIPS_PAID', 'Payslip', null,
        { count: ids.length, success: results.success, failed: results.failed },
        results.failed > 0 ? 'WARNING' : 'SUCCESS', null, organizationId
    ).catch(() => {});

    return results;
};

/**
 * Unified View: Fetches all processed payroll records and merges with payslip status.
 * This ensures that if a payroll is processed but payslip is not generated, it still shows up.
 */
const getGeneratedPayslips = async (filters) => {
    const { month, year, employeeId, organizationId } = filters;
    const where = { organizationId, isDeleted: false };
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (employeeId) where.employeeId = employeeId;

    const history = await prisma.processedPayroll.findMany({
        where,
        include: { payslip: true },
        orderBy: { createdAt: 'desc' }
    });

    // Map to a unified format that the frontend expects (compatible with Payslip model)
    return history.map(record => {
        const pRecord = formatProcessedPayroll(record);
        const payslip = pRecord.payslip;
        return {
            id: payslip?.id || `pp-${pRecord.id}`, // fallback ID if not generated
            processedPayrollId: pRecord.id,
            status: pRecord.isPaid ? 'PAID' : (payslip?.status || 'PENDING'), 
            isEmailSent: payslip?.isEmailSent || false,
            lastEmailSentAt: payslip?.lastEmailSentAt,
            month: pRecord.month,
            year: pRecord.year,
            
            // Standardized Fields
            netPay: pRecord.netPay,
            netSalary: pRecord.netPay,
            gross: payslip?.gross || pRecord.grossYield,
            totalDeductions: payslip?.totalDeductions || pRecord.liability,
            earnings: payslip?.earnings || pRecord.earnings || [],
            deductions: payslip?.deductions || pRecord.deductions || [],
            
            grossYield: pRecord.grossYield,
            liability: pRecord.liability,
            breakdown: pRecord.breakdown,
            employeeInfo: pRecord.employeeInfo,
            bankDetails: pRecord.bankDetails,
            paidAt: pRecord.isPaid ? pRecord.paidAt : payslip?.paidAt,
            paidBy: pRecord.isPaid ? pRecord.paidBy : payslip?.paidBy,
            generatedAt: payslip?.generatedAt,
            isGenerated: !!payslip,
            employeeId: pRecord.employeeId
        };
    });
};


/**
 * Fetches personal payslips for an employee.
 */
const getEmployeePayslips = async (userId, organizationId, month, year) => {
    const where = { 
        employee: { userId }, 
        organizationId,
        isDeleted: false 
    };
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const payslips = await prisma.payslip.findMany({
        where,
        include: { processedPayroll: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    return payslips.map(p => ({
        ...formatPayslip(p),
        isPaid: p.processedPayroll?.isPaid || p.status === 'PAID'
    }));
};

module.exports = {
  simulateUserPayroll,
  saveProcessedPayroll,
  markAsPaid,
  markPayslipAsPaid,
  bulkMarkPayslipsAsPaid,
  ensureBatchExists,
  getPayrollSummary,
  getDepartmentCostAnalysis,
  getDashboardTrends,
  getPayrollDashboard,
  getPayrollAnalytics,
  runPayroll,
  generatePayslips,
  getGeneratedPayslips,
  getEmployeePayslips,
  getPayrollBatches,
  calculateAttendance,
  calculateSalaryBreakdown,
  upsertFullPayrollProfile,
  getReadinessCheck,
  getPayrollPreview
};
