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
    pf: { enabled: true, employeePercent: 12, employerPercent: 12, threshold: 15000, restrictToCeiling: true },
    pt: { 
      enabled: true, 
      state: 'TN', 
      mode: 'MONTHLY', // MONTHLY, HALF_YEARLY, YEARLY
      deductionMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      slabs: [{ min: 0, max: 15000, amount: 0 }, { min: 15001, max: 99999999, amount: 200 }] 
    },
    esi: { enabled: true, employeePercent: 0.75, employerPercent: 3.25, threshold: 21000 },
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
          employeePercent: legacyPayroll.pfRate || 12,
          employerPercent: legacyPayroll.pfEmployerRate || 12,
          threshold: legacyPayroll.pfWageLimit || 15000,
          restrictToCeiling: legacyPayroll.pfRestrictToCeiling ?? true
        },
        esi: {
          enabled: legacyPayroll.taxToggles?.esi ?? true,
          employeePercent: legacyPayroll.esiRate || 0.75,
          employerPercent: legacyPayroll.esiEmployerRate || 3.25,
          threshold: legacyPayroll.esiLimit || 21000
        },
        tds: {
          enabled: legacyPayroll.taxToggles?.tds ?? true,
          regime: legacyPayroll.taxRegime || 'OLD',
          threshold: legacyPayroll.tdsThreshold || 50000,
          slabs: legacyPayroll.taxSlabs || defaultPolicy.statutory.tds.slabs
        },
        pt: {
          enabled: legacyPayroll.taxToggles?.pt ?? true,
          slabs: legacyPayroll.ptSlabs || defaultPolicy.statutory.pt.slabs,
          state: legacyPayroll.ptState || 'MH',
          mode: legacyPayroll.ptMode || 'MONTHLY'
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
    if (!organizationId) {
      logger.warn("getPolicy called without organizationId - accessing default active policy");
    }

    const where = { isActive: true };
    if (organizationId) where.organizationId = organizationId;
    
    let policy = await prisma.payrollPolicy.findFirst({ 
      where,
      orderBy: { version: 'desc' } 
    });
    
    if (!policy) {
      // Try to migrate from old settings if they exist
      logger.info(`No policy record for org ${organizationId}, attempting migration...`);
      policy = await migrateToUnifiedPolicy(organizationId);
      
      // PERSIST the migrated policy so we have an actual record to update later
      const { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance, name } = policy;
      const rules = { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance };
      
      policy = await prisma.payrollPolicy.create({
        data: {
          name: name || 'Unified Payroll Policy',
          rules: rules,
          organizationId,
          version: 1,
          isActive: true
        }
      });
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
      finalRules.statutory.pt.state = 'MH'; // Default to Maharashtra for broad template use
    }
    if (finalRules.statutory.pf && finalRules.statutory.pf.restrictToCeiling === undefined) {
      finalRules.statutory.pf.restrictToCeiling = true;
    }
    if (finalRules.statutory.pt && finalRules.statutory.pt.mode === undefined) {
      finalRules.statutory.pt.mode = 'MONTHLY';
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
    logger.info(`No active policy found for org ${organizationId}, creating one.`);
    return await createPolicyVersion(policyData, organizationId);
  }

  // Explicitly extract config fields and merge with existing rules
  const { statutory, attendance, overtime, rounding, salaryComponents, leave, compliance, name } = policyData;
  const existingRules = (policy.rules && typeof policy.rules === 'object') ? policy.rules : {};
  
  const rules = { 
    ...existingRules,
    ...(statutory && { statutory }),
    ...(attendance && { attendance }),
    ...(overtime && { overtime }),
    ...(rounding && { rounding }),
    ...(salaryComponents && { salaryComponents }),
    ...(leave && { leave }),
    ...(compliance && { compliance })
  };

  const dataToSave = {
    name: name || policyData.name || policy.name,
    rules: rules,
    isActive: policyData.isActive !== undefined ? policyData.isActive : true
  };

  const updated = await prisma.payrollPolicy.update({
    where: { 
      id: policy.id,
      // Extra security: ensure we only update for the correct organization if provided
      ...(organizationId && { organizationId }) 
    },
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
        employeePercent: legacyPayroll.pfRate || (activePolicy.statutory?.pf?.employeePercent || 12),
        employerPercent: legacyPayroll.pfEmployerRate || (activePolicy.statutory?.pf?.employerPercent || 12),
        threshold: legacyPayroll.pfWageLimit || (activePolicy.statutory?.pf?.threshold || 15000)
      },
      esi: {
        enabled: legacyPayroll.taxToggles?.esi ?? (activePolicy.statutory?.esi?.enabled ?? true),
        employeePercent: legacyPayroll.esiRate || (activePolicy.statutory?.esi?.employeePercent || 0.75),
        employerPercent: legacyPayroll.esiEmployerRate || (activePolicy.statutory?.esi?.employerPercent || 3.25),
        threshold: legacyPayroll.esiLimit || (activePolicy.statutory?.esi?.threshold || 21000)
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
