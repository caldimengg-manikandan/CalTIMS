const PayrollPolicy = require('./payrollPolicy.model');
const Settings = require('../settings/settings.model');
const OrganizationPolicy = require('./organizationPolicy.model');
const logger = require('../../shared/utils/logger');

const defaultPolicy = {
  name: 'Default Unified Policy',
  version: 1,
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
    pt: { enabled: true, slabs: [{ min: 0, max: 15000, amount: 0 }, { min: 15001, max: 99999999, amount: 200 }] },
    esi: { enabled: true, employeeRate: 0.75, employerRate: 3.25, wageLimit: 21000 },
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
const migrateToUnifiedPolicy = async (companyId = null) => {
  try {
    const settings = await Settings.findOne().lean();
    const orgPolicy = await OrganizationPolicy.findOne(companyId ? { companyId } : {}).lean();
    
    if (!settings && !orgPolicy) return defaultPolicy;

    const legacyPayroll = settings?.payroll || {};
    
    const migratedPolicy = {
      ...defaultPolicy,
      companyId,
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
        types: orgPolicy?.leave?.types || defaultPolicy.leave.types,
        allowNegativeBalance: orgPolicy?.leave?.allowNegativeBalance || false
      }
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
const getPolicy = async (companyId = null) => {
  try {
    const query = { isActive: true };
    if (companyId) query.companyId = companyId;
    
    let policy = await PayrollPolicy.findOne(query).lean();
    if (!policy) {
      const migratedData = await migrateToUnifiedPolicy(companyId);
      policy = await PayrollPolicy.create(migratedData);
    }
    
    return policy;
  } catch (err) {
    logger.error(`Error fetching policy: ${err.message}`);
    return defaultPolicy;
  }
};

/**
 * Creates a new policy version.
 */
const createPolicyVersion = async (policyData, companyId = null) => {
  const latestPolicy = await PayrollPolicy.findOne(companyId ? { companyId } : {}).sort({ version: -1 });
  const nextVersion = latestPolicy ? latestPolicy.version + 1 : 1;

  const newPolicy = new PayrollPolicy({
    ...policyData,
    companyId,
    version: nextVersion,
    isActive: true
  });

  await newPolicy.save();
  return newPolicy;
};

/**
 * Updates the existing active policy.
 */
const updatePolicy = async (policyData, companyId = null) => {
  const query = { isActive: true };
  if (companyId) query.companyId = companyId;

  let policy = await PayrollPolicy.findOne(query);
  if (!policy) {
    return await createPolicyVersion(policyData, companyId);
  }

  // Update fields
  Object.assign(policy, policyData);
  await policy.save();
  return policy;
};

module.exports = {
  getPolicy,
  updatePolicy,
  createPolicyVersion,
  defaultPolicy
};
