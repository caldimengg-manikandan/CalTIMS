/**
 * CENTRALIZED STATUTORY COMPLIANCE ENGINE (BACKEND)
 * Single source of truth for Indian Payroll Compliance
 */

const calculatePF = (basic, da, policy) => {
  if (!policy?.enabled) return { employeePF: 0, employerEPF: 0, employerEPS: 0, totalEmployer: 0 };

  const { employeePercent = 12, employerPercent = 12, threshold = 15000, restrictToCeiling = true } = policy;
  
  // Base for calculation (Basic + DA)
  const baseForPF = (basic || 0) + (da || 0);
  
  // Effective base considering ceiling
  const effectiveBase = restrictToCeiling ? Math.min(baseForPF, threshold) : baseForPF;

  // Employee Contribution (Standard 12%)
  const employeePF = Math.round(effectiveBase * (employeePercent / 100));

  // Employer Contribution Split (Standard Indian Rule)
  // EPS (Pension) is 8.33% of base, capped at 15,000 ceiling regardless of policy ceiling for EPF
  const epsBase = Math.min(baseForPF, 15000); 
  const employerEPS = Math.round(epsBase * (8.33 / 100));
  
  // Total Employer (usually matching 12% of effective base)
  const totalEmployerProposal = Math.round(effectiveBase * (employerPercent / 100));
  
  // EPF (Provident Fund) is the remainder
  const employerEPF = Math.max(0, totalEmployerProposal - employerEPS);

  return {
    employeePF,
    employerEPF,
    employerEPS,
    totalEmployer: employerEPF + employerEPS,
    baseUsed: effectiveBase
  };
};

/**
 * Calculate ESI deduction.
 *
 * @param {number} gross            - Actual (prorated) gross — used for deduction AMOUNT.
 * @param {object} policy           - ESI policy config.
 * @param {boolean} hasPriorEligibility - True if employee was ESI-eligible at contribution period start.
 * @param {number|null} fullMonthGross  - Full-month equivalent salary — used for ELIGIBILITY check.
 *                                        Handles mid-month joiners: a ₹30k employee who joined mid-month
 *                                        may have a prorated gross of ₹13k, but is NOT eligible because
 *                                        their full-month salary exceeds the ₹21,000 threshold.
 *                                        If null, falls back to `gross` (backward-compatible).
 */
const calculateESI = (gross, policy, hasPriorEligibility = false, fullMonthGross = null) => {
  if (!policy?.enabled) return { employeeESI: 0, employerESI: 0, isEligible: false };

  const { employeePercent = 0.75, employerPercent = 3.25, threshold = 21000 } = policy;

  // ── Eligibility: use full-month equivalent salary, NOT prorated gross ──────
  // This prevents mid-month joiners from being incorrectly flagged as eligible.
  const eligibilityBasis = fullMonthGross !== null ? fullMonthGross : gross;
  const isEligible = (eligibilityBasis <= threshold) || hasPriorEligibility;

  console.log('[ESI Eligibility Check]', {
    actualGross: gross,
    eligibilityBasis,
    fullMonthGross,
    threshold,
    hasPriorEligibility,
    eligible: isEligible
  });

  if (!isEligible) return { employeeESI: 0, employerESI: 0, isEligible: false };

  // ── Deduction: always calculated on actual (prorated) gross ─────────────────
  const employeeESI = Math.ceil(gross * (employeePercent / 100)); // ESI rounded UP to next rupee
  const employerESI = Math.ceil(gross * (employerPercent / 100));

  return { employeeESI, employerESI, isEligible: true };
};

const calculatePT = (gross, monthIndex, policy) => {
  if (!policy?.enabled || !policy.slabs) return 0;

  const { slabs = [], state = "MH", mode = "MONTHLY" } = policy;

  // Find the applicable slab
  const slab = slabs.find(
    (s) => gross >= s.min && gross <= (s.max || 999999999)
  );

  if (!slab) return 0;

  let amount = slab.amount;

  // Generic Month Overrides Support
  if (slab.overrides && slab.overrides[monthIndex] !== undefined) {
    amount = slab.overrides[monthIndex];
  } else {
    // Fallback for legacy Maharashtra February Rule if not explicitly defined in overrides
    // applies only in MONTHLY mode.
    if (state === "MH" && mode === "MONTHLY" && monthIndex === 1) {
      // 1 is February (0-indexed)
      if (amount === 200) amount = 300;
    }
  }

  return amount;
};

const getESIPeriodStart = (month, year) => {
  // Period 1: April (3) to Sep (8) -> Starts April
  // Period 2: Oct (9) to Mar (2) -> Starts October
  if (month >= 3 && month <= 8) {
    return { month: 3, year };
  } else {
    const startYear = month <= 2 ? year - 1 : year;
    return { month: 9, year: startYear };
  }
};

module.exports = {
  calculatePF,
  calculateESI,
  calculatePT,
  getESIPeriodStart
};
