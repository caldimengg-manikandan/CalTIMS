export const ROLE_TEMPLATES = {
  'manager': {
    earnings: [
      { name: 'Basic Salary', value: 50, calculationType: 'Percentage', basedOn: 'CTC' },
      { name: 'House Rent Allowance (HRA)', value: 50, calculationType: 'Percentage', basedOn: 'Basic Salary' },
      { name: 'Management Allowance', value: 20000, calculationType: 'Fixed' }
    ],
    deductions: [
      { name: 'Provident Fund (PF)', value: 12, calculationType: 'Percentage', basedOn: 'Basic Salary' },
      { name: 'Professional Tax', value: 200, calculationType: 'Fixed' }
    ]
  },
  'employee': {
    earnings: [
      { name: 'Basic Salary', value: 40, calculationType: 'Percentage', basedOn: 'CTC' },
      { name: 'House Rent Allowance (HRA)', value: 40, calculationType: 'Percentage', basedOn: 'Basic Salary' },
      { name: 'Special Allowance', value: 5000, calculationType: 'Fixed' }
    ],
    deductions: [
      { name: 'Provident Fund (PF)', value: 12, calculationType: 'Percentage', basedOn: 'Basic Salary' },
      { name: 'ESI', value: 0.75, calculationType: 'Percentage', basedOn: 'Gross' }
    ]
  },
  'intern': {
    earnings: [
      { name: 'Stipend', value: 25000, calculationType: 'Fixed' }
    ],
    deductions: []
  }
};

/**
 * UNIVERSAL FRONTEND CALCULATION ENGINE v3
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule: Must remain synchronized with Backend payroll.service.js v3.
 *       Statutory deductions are driven by Profile Mode overrides.
 */
export const calculateSalaryBreakdown = (earnings = [], deductions = [], monthlyCTC = 0, policy = null, attendanceCtx = null) => {
  const results = {
    earnings: [],
    deductions: [],
    statutoryDeductions: [],
    employerContributions: [],
    grossPay: 0,
    totalDeductions: 0,
    netSalary: 0,
    breakdown: {},
    lopDeduction: 0,
    adjustedGross: 0,
    perDaySalary: 0,
    workingDays: 30,
    payableDays: 30,
    daysAfterJoin: 30,
    preJoinDays: 0
  };

  const applyRounding = (val) => Math.round((val || 0) * 100) / 100;

  const resolveVal = (comp, base) => {
    let val = parseFloat(comp.value) || 0;
    if (comp.calculationType?.toLowerCase() === 'percentage') val = (base * val) / 100;
    return applyRounding(val);
  };

  // ── 1. Calendar & Proration Foundation ───────────────────────────────────
  const totalDaysInMonth = attendanceCtx?.calendarDaysInMonth || 30;
  const rawPreJoinDays = attendanceCtx?.preJoinDays || 0;
  const rawLopDays = attendanceCtx?.lopDays || 0;

  const daysAfterJoin = Math.max(0, totalDaysInMonth - rawPreJoinDays);
  const lopDays = Math.min(rawLopDays, daysAfterJoin);
  const payableDays = Math.max(0, daysAfterJoin - lopDays);

  const perDaySalary = applyRounding(totalDaysInMonth > 0 ? monthlyCTC / totalDaysInMonth : 0);
  const lopDeduction = applyRounding(perDaySalary * rawLopDays);
  const adjustedGross = applyRounding(perDaySalary * payableDays);
  const prorationRatio = totalDaysInMonth > 0 ? payableDays / totalDaysInMonth : 0;

  results.workingDays = daysAfterJoin;
  results.standardMonthlyDays = totalDaysInMonth;
  results.daysAfterJoin = daysAfterJoin;
  results.preJoinDays = rawPreJoinDays;
  results.payableDays = payableDays;
  results.presentDays = payableDays;
  results.perDaySalary = perDaySalary;
  results.adjustedGross = adjustedGross;
  results.lopDeduction = lopDeduction;

  // ── 2. Resolve Statutory Overrides (Profile-Driven) ──────────────────────
  const resolveStatutory = (type, profileCfg, policyCfg) => {
    const cfg = profileCfg?.[type] || { mode: 'default' };
    const mode = cfg.mode || 'default';
    
    if (mode === 'enabled') {
      return { ...policyCfg?.[type], ...cfg, enabled: true, source: 'Payroll Profile (Override)' };
    } else if (mode === 'disabled') {
      return { enabled: false, source: 'Payroll Profile (Override)' };
    } else {
      return { ...policyCfg?.[type], source: 'Company Policy' };
    }
  };

  const pfConfig = resolveStatutory('pf', policy?.profile, policy?.statutory);
  const esiConfig = resolveStatutory('esi', policy?.profile, policy?.statutory);
  const ptConfig = resolveStatutory('pt', policy?.profile, policy?.statutory);
  const gratuityConfig = resolveStatutory('gratuity', policy?.profile, policy?.statutory);

  // ── 3. Base Gross (Full-Month, before proration) ──────────────────────────
  const filteredEarnings = earnings.filter(e => !e.hidden && !e._isStatutoryConfig && !(e.name || '').includes('Metadata'));

  // Pass 1: CTC-based earnings
  filteredEarnings.filter(e => !e.basedOn || e.basedOn === 'CTC').forEach(comp => {
    const val = resolveVal(comp, monthlyCTC);
    results.breakdown[comp.name] = val;
  });

  // Pass 2: Dependent Earnings (e.g. HRA on Basic)
  filteredEarnings.filter(e => e.basedOn && e.basedOn !== 'CTC').forEach(comp => {
    const base = results.breakdown[comp.basedOn] || 0;
    const val = resolveVal(comp, base);
    results.breakdown[comp.name] = val;
  });

  // ── 4. Apply Proration to Earnings ───────────────────────────────────────
  let proratedGross = 0;
  results.earnings = filteredEarnings.map(e => {
    const proratedVal = applyRounding((results.breakdown[e.name] || 0) * prorationRatio);
    proratedGross += proratedVal;
    return { ...e, calculatedValue: proratedVal };
  });

  results.grossPay = applyRounding(proratedGross);

  const basicKey = Object.keys(results.breakdown).find(k => k.toLowerCase().includes('basic'));
  const basicSalary = basicKey ? applyRounding(results.breakdown[basicKey] * prorationRatio) : (results.grossPay * 0.5);

  // ── 5. Statutory Deductions ──────────────────────────────────────────────
  // PF
  if (pfConfig.enabled) {
    const pfThreshold = pfConfig.threshold || 15000;
    const pfBase = pfConfig.restrictToCeiling ? Math.min(basicSalary, pfThreshold) : basicSalary;
    const pfAmount = applyRounding((pfBase * (pfConfig.employeePercent || 12)) / 100);
    results.statutoryDeductions.push({ name: 'Provident Fund (PF)', calculatedValue: pfAmount, isStatutory: true, source: pfConfig.source });
    results.totalDeductions += pfAmount;

    if (pfConfig.employerPercent > 0) {
       results.employerContributions.push({ name: 'Employer PF Share', calculatedValue: applyRounding((pfBase * pfConfig.employerPercent) / 100) });
    }
  }

  // ESI
  if (esiConfig.enabled) {
    if (adjustedGross <= (esiConfig.threshold || 21000)) {
      const esiAmount = applyRounding((adjustedGross * (esiConfig.employeePercent || 0.75)) / 100);
      results.statutoryDeductions.push({ name: 'ESI', calculatedValue: esiAmount, isStatutory: true, source: esiConfig.source });
      results.totalDeductions += esiAmount;
    }
  }

  // PT
  if (ptConfig.enabled) {
    const slabs = ptConfig.slabs || [];
    const slab = slabs.find(s => adjustedGross >= s.min && adjustedGross <= (s.max || 999999999));
    const ptAmount = slab ? (slab.amount || 0) : 0;
    if (ptAmount > 0) {
      results.statutoryDeductions.push({ name: 'Professional Tax (PT)', calculatedValue: ptAmount, isStatutory: true, source: ptConfig.source });
      results.totalDeductions += ptAmount;
    }
  }

  // Gratuity
  if (gratuityConfig.enabled && basicSalary > 0) {
    const gratuityAmount = applyRounding((basicSalary * (15 / 26)) / 12);
    results.employerContributions.push({ name: 'Gratuity Provision', calculatedValue: gratuityAmount, source: gratuityConfig.source });
  }

  // ── 6. Profile Deductions (prorated) ─────────────────────────────────────
  const filteredDeductions = deductions.filter(d => {
    const n = (d.name || '').toLowerCase();
    if (d.hidden || d._isStatutoryConfig || n.includes('metadata')) return false;
    if ((n.includes('pf') || n.includes('provident')) && pfConfig.enabled) return false;
    if (n.includes('esi') && esiConfig.enabled) return false;
    if ((n.includes('pt') || n.includes('tax')) && ptConfig.enabled) return false;
    return true;
  });

  filteredDeductions.forEach(comp => {
    const val = resolveVal(comp, results.breakdown[comp.basedOn] || monthlyCTC);
    const proratedVal = applyRounding(val * prorationRatio);
    results.deductions.push({ ...comp, calculatedValue: proratedVal });
    results.totalDeductions += proratedVal;
  });

  // LOP row
  if (lopDeduction > 0) {
    results.deductions.push({ name: 'LOP Deduction', calculatedValue: lopDeduction, isLOP: true });
    results.totalDeductions += lopDeduction;
  }

  results.totalDeductions = applyRounding(results.totalDeductions);
  results.netSalary = applyRounding(results.grossPay - results.totalDeductions);

  return results;
};
