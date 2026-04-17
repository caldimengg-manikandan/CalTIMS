const { prisma } = require('../../config/database');
const logger = require('../../shared/utils/logger');

const defaultPolicy = {
  name: 'Default Unified Policy',
  version: 2,
  isActive: true,
  salaryComponents: [
    { name: 'Basic Salary', type: 'EARNING', calculationType: 'percentage', value: 40, formula: 'CTC' },
    { name: 'HRA', type: 'EARNING', calculationType: 'percentage', value: 40, formula: 'BASIC' },
    { name: 'Special Allowance', type: 'EARNING', calculationType: 'formula', formula: 'CTC - (BASIC + HRA)' },
    { name: 'PF', type: 'DEDUCTION', calculationType: 'percentage', value: 12, formula: 'BASIC', isStatutory: true },
    { name: 'Professional Tax', type: 'DEDUCTION', calculationType: 'fixed', value: 200, isStatutory: true }
  ],
  statutory: {
    pf: { enabled: true, employeeRate: 12, employerRate: 12, wageLimit: 15000 },
    pt: { 
      enabled: true, 
      state: 'TN', 
      frequency: 'MONTHLY', // MONTHLY, HALF_YEARLY, YEARLY
      deductionMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      slabs: [{ min: 0, max: 15000, amount: 0 }, { min: 15001, max: 99999999, amount: 200 }] 
    },
    esi: { enabled: true, employeeRate: 0.75, employerRate: 3.25, wageLimit: 21000 },
    gratuity: { enabled: false, includeInCTC: true, showAccrued: false },
    tds: { 
      enabled: true, 
      regime: 'OLD', 
      threshold: 50000,
      slabs: [
        { min: 0, max: 250000, rate: 0 },
        { min: 250001, max: 500000, rate: 5 },
        { min: 500001, max: 1000000, rate: 20 },
        { min: 1000001, max: 999999999, rate: 30 }
      ]
    }
  },
  attendance: {
    workingDaysPerMonth: 22,
    workingHoursPerDay: 8,
    lopCalculation: 'PER_DAY',
    includeWeekends: false,
    prorateSalary: true
  },
  overtime: {
    enabled: false,
    multiplier: 1.5,
    maxHours: 40
  },
  rounding: {
    decimals: 2,
    rule: 'ROUND_OFF'
  },
  leave: {
    types: [
      { name: 'Annual', paid: true },
      { name: 'Sick', paid: true },
      { name: 'Casual', paid: true },
      { name: 'LOP', paid: false }
    ],
    allowNegativeBalance: false
  }
};

/**
 * Migrates data from legacy Settings and OrganizationPolicy to the new PayrollPolicy.
 */
const migrateToUnifiedPolicy = async (organizationId = null) => {
  try {
    const settings = organizationId 
       ? await prisma.orgSettings.findUnique({ where: { organizationId } }) 
       : await prisma.orgSettings.findFirst();
    
    if (!settings) return { ...defaultPolicy, organizationId };

    const legacyPayroll = settings?.payroll || {};
    
    const migratedPolicy = {
      ...defaultPolicy,
      organizationId,
      statutory: {
        ...defaultPolicy.statutory,
        pf: {
          enabled: legacyPayroll.taxToggles?.pf ?? true,
          employeeRate: legacyPayroll.pfRate || 12,
          employerRate: legacyPayroll.pfEmployerRate || 12,
          wageLimit: legacyPayroll.pfWageLimit || 15000
        },
        esi: {
          enabled: legacyPayroll.taxToggles?.esi ?? true,
          employeeRate: legacyPayroll.esiRate || 0.75,
          employerRate: legacyPayroll.esiEmployerRate || 3.25,
          wageLimit: legacyPayroll.esiLimit || 21000
        },
        tds: {
          enabled: legacyPayroll.taxToggles?.tds ?? true,
          regime: legacyPayroll.taxRegime || 'OLD',
          threshold: legacyPayroll.tdsThreshold || 50000,
          slabs: legacyPayroll.taxSlabs || defaultPolicy.statutory.tds.slabs
        },
        pt: {
          enabled: legacyPayroll.taxToggles?.pt ?? true,
          slabs: legacyPayroll.ptSlabs || defaultPolicy.statutory.pt.slabs
        }
      },
      attendance: {
        workingDaysPerMonth: settings?.payroll?.workingDaysPerMonth || 22,
        workingHoursPerDay: settings?.payroll?.workingHoursPerDay || 8,
        lopCalculation: settings?.payroll?.lopCalculation || 'PER_DAY',
        includeWeekends: settings?.organization?.workWeek === 'Mon-Sun',
        prorateSalary: settings?.payroll?.salaryProration ?? true,
        workWeek: settings?.organization?.workWeek || 'Mon-Fri',
        weekStartDay: settings?.general?.weekStartDay || 'monday'
      },
      overtime: {
        enabled: legacyPayroll.overtimeEnabled || false,
        multiplier: legacyPayroll.overtimeMultiplier || 1.5
      },
      compliance: {
        timesheetFreezeDay: settings?.compliance?.timesheetFreezeDay || 28,
        allowBackdatedEntries: settings?.compliance?.allowBackdatedEntries ?? true
      },
      leave: {
        types: defaultPolicy.leave.types,
        allowNegativeBalance: false
      },
      organizationId
    };

    return migratedPolicy;
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    return defaultPolicy;
  }
};

/**
 * Retrieves the active payroll policy.
 */
const getPolicy = async (organizationId = null) => {
  try {
    const where = { isActive: true };
    if (organizationId) where.organizationId = organizationId;
    
    let policy = await prisma.payrollPolicy.findFirst({ where });
    if (!policy) {
       return { ...defaultPolicy, organizationId };
    }
    
    // Flatten rules into the root object for the frontend
    const { rules, ...rest } = policy;
    const finalRules = (rules && typeof rules === 'object') ? rules : {};
    
    // Backward Compatibility Migrations
    if (!finalRules.statutory) finalRules.statutory = { ...defaultPolicy.statutory };
    if (!finalRules.statutory.gratuity) {
      finalRules.statutory.gratuity = { ...defaultPolicy.statutory.gratuity };
    }
    if (finalRules.statutory.pt && finalRules.statutory.pt.state === undefined) {
      finalRules.statutory.pt.state = 'TN'; // Default to Tamil Nadu
    }
    if (finalRules.statutory.pt && finalRules.statutory.pt.frequency === undefined) {
      finalRules.statutory.pt.frequency = 'MONTHLY';
      finalRules.statutory.pt.deductionMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }
    if (!finalRules.attendance) {
      finalRules.attendance = { ...defaultPolicy.attendance };
    }
    if (!finalRules.overtime) {
      finalRules.overtime = { ...defaultPolicy.overtime };
    }
    if (!finalRules.rounding) {
        finalRules.rounding = { ...defaultPolicy.rounding };
    }

    return { ...rest, ...finalRules };
  } catch (err) {
    logger.error(`Error fetching policy: ${err.message}`);
    return { ...defaultPolicy, organizationId };
  }
};

/**
 * Creates a new policy version.
 */
const createPolicyVersion = async (policyData, organizationId = null) => {
  const latestPolicy = await prisma.payrollPolicy.findFirst({
    where: organizationId ? { organizationId } : {},
    orderBy: { version: 'desc' }
  });
  const nextVersion = latestPolicy ? latestPolicy.version + 1 : 1;

  // Explicitly extract config fields to avoid nesting
  const { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance } = policyData;
  const rules = { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance };

  const newPolicy = await prisma.payrollPolicy.create({
    data: {
      name: policyData.name || 'Unified Payroll Policy',
      rules: rules,
      organizationId,
      version: nextVersion,
      isActive: true
    }
  });

  return newPolicy;
};

/**
 * Updates the existing active policy.
 */
const updatePolicy = async (policyData, organizationId = null) => {
  const where = { isActive: true };
  if (organizationId) where.organizationId = organizationId;

  let policy = await prisma.payrollPolicy.findFirst({ where });
  
  if (!policy) {
    return await createPolicyVersion(policyData, organizationId);
  }

  // Explicitly extract config fields to avoid nesting
  const { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance } = policyData;
  const rules = { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance };

  const dataToSave = {
    name: policyData.name || policy.name,
    rules: rules,
    isActive: policyData.isActive !== undefined ? policyData.isActive : true
  };

  const updated = await prisma.payrollPolicy.update({
    where: { id: policy.id },
    data: dataToSave
  });

  // Return flattened for immediate UI use
  const { rules: updatedRules, ...rest } = updated;
  return { ...rest, ...updatedRules };
};

/**
 * Syncs legacy payroll settings from OrgSettings to the active PayrollPolicy.
 */
const syncLegacyPayrollToPolicy = async (legacyPayroll, organizationId) => {
  try {
    const activePolicy = await getPolicy(organizationId);
    
    const updatedStatutory = {
      ...(activePolicy.statutory || defaultPolicy.statutory),
      pf: {
        enabled: legacyPayroll.taxToggles?.pf ?? (activePolicy.statutory?.pf?.enabled ?? true),
        employeeRate: legacyPayroll.pfRate || (activePolicy.statutory?.pf?.employeeRate || 12),
        employerRate: legacyPayroll.pfEmployerRate || (activePolicy.statutory?.pf?.employerRate || 12),
        wageLimit: legacyPayroll.pfWageLimit || (activePolicy.statutory?.pf?.wageLimit || 15000)
      },
      esi: {
        enabled: legacyPayroll.taxToggles?.esi ?? (activePolicy.statutory?.esi?.enabled ?? true),
        employeeRate: legacyPayroll.esiRate || (activePolicy.statutory?.esi?.employeeRate || 0.75),
        employerRate: legacyPayroll.esiEmployerRate || (activePolicy.statutory?.esi?.employerRate || 3.25),
        wageLimit: legacyPayroll.esiLimit || (activePolicy.statutory?.esi?.wageLimit || 21000)
      },
      tds: {
        enabled: legacyPayroll.taxToggles?.tds ?? (activePolicy.statutory?.tds?.enabled ?? true),
        regime: legacyPayroll.taxRegime || (activePolicy.statutory?.tds?.regime || 'OLD'),
        threshold: legacyPayroll.tdsThreshold || (activePolicy.statutory?.tds?.threshold || 50000),
        slabs: legacyPayroll.taxSlabs || (activePolicy.statutory?.tds?.slabs || defaultPolicy.statutory.tds.slabs)
      }
    };

    const updatedAttendance = {
      ...(activePolicy.attendance || defaultPolicy.attendance),
      workingDaysPerMonth: legacyPayroll.workingDaysPerMonth || (activePolicy.attendance?.workingDaysPerMonth || 22),
      workingHoursPerDay: legacyPayroll.workingHoursPerDay || (activePolicy.attendance?.workingHoursPerDay || 8),
      lopCalculation: legacyPayroll.lopCalculation || (activePolicy.attendance?.lopCalculation || 'PER_DAY'),
      prorateSalary: legacyPayroll.salaryProration ?? (activePolicy.attendance?.prorateSalary ?? true)
    };

    await updatePolicy({
      ...activePolicy,
      statutory: updatedStatutory,
      attendance: updatedAttendance,
      overtime: {
        enabled: legacyPayroll.overtimeEnabled ?? (activePolicy.overtime?.enabled ?? false),
        multiplier: legacyPayroll.overtimeMultiplier || (activePolicy.overtime?.multiplier || 1.5)
      }
    }, organizationId);

    return true;
  } catch (err) {
    logger.error(`Sync failed: ${err.message}`);
    return false;
  }
};

module.exports = {
  getPolicy,
  updatePolicy,
  createPolicyVersion,
  syncLegacyPayrollToPolicy,
  defaultPolicy
};
