/**
 * CENTRALIZED STATUTORY COMPLIANCE ENGINE
 * Rules driven by Indian Government Statutory Norms
 */

export const calculatePF = (basicSalary, daSalary = 0, policy) => {
  if (!policy?.enabled) return { employeePF: 0, employerEPF: 0, employerEPS: 0, totalEmployer: 0 };

  const { employeeRate = 12, employerRate = 12, wageLimit = 15000, restrictToCeiling = true } = policy;
  
  const totalBase = (basicSalary || 0) + (daSalary || 0);

  // Base for calculation
  const effectiveBase = restrictToCeiling ? Math.min(totalBase, wageLimit) : totalBase;

  // Employee Contribution
  const employeePF = Math.round(effectiveBase * (employeeRate / 100));

  // Employer Split (Standard Indian Rule)
  // EPS is typically 8.33% of basic+da (capped at 15k ceiling)
  const epsBase = Math.min(totalBase, 15000); 
  const employerEPS = Math.round(epsBase * (8.33 / 100));
  
  // Total Employer is usually 12% of effective base
  const totalEmployerProposal = Math.round(effectiveBase * (employerRate / 100));
  
  // EPF is the remainder
  const employerEPF = Math.max(0, totalEmployerProposal - employerEPS);

  return {
    employeePF,
    employerEPF,
    employerEPS,
    totalEmployer: employerEPF + employerEPS
  };
};

export const calculateESI = (grossSalary, policy, hasPriorEligibility = false) => {
  if (!policy?.enabled) return { employeeESI: 0, employerESI: 0, isEligible: false };

  const { employeeRate = 0.75, employerRate = 3.25, wageLimit = 21000 } = policy;

  // Eligibility Rule: Gross <= Limit OR already eligible in current contribution period
  const isEligible = (grossSalary <= wageLimit) || hasPriorEligibility;

  if (!isEligible) return { employeeESI: 0, employerESI: 0, isEligible: false };

  const employeeESI = Math.ceil(grossSalary * (employeeRate / 100)); // ESI rounded up to next rupee
  const employerESI = Math.ceil(grossSalary * (employerRate / 100));

  return { employeeESI, employerESI, isEligible: true };
};

export const calculatePT = (grossSalary, policy, monthIndex = 0) => {
  if (!policy?.enabled || !policy.slabs) return 0;

  const { slabs = [], state = "MH", mode = "MONTHLY" } = policy;

  // Find the applicable slab
  const slab = slabs.find(
    (s) => grossSalary >= s.min && grossSalary <= (s.max || 999999999)
  );

  if (!slab) return 0;

  let amount = slab.amount;

  // Generic Month Overrides Support
  if (slab.overrides && slab.overrides[monthIndex] !== undefined) {
    amount = slab.overrides[monthIndex];
  } else {
    // Legacy Maharashtra February Rule (Applies only in MONTHLY mode or if specifically requested)
    if (state === "MH" && mode === "MONTHLY" && monthIndex === 1) {
      // 1 is February
      if (amount === 200) amount = 300;
    }
  }

  return amount;
};

export const complianceEngine = {
  calculatePF,
  calculateESI,
  calculatePT
};
