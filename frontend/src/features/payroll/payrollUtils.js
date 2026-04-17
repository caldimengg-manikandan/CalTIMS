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
 * UNIVERSAL FRONTEND CALCULATION ENGINE
 * Rule: Logic must remain byte-identical to Backend payroll.service.js
 */
/**
 * UNIVERSAL FRONTEND CALCULATION ENGINE
 * Rule: Logic must remain byte-identical to Backend payroll.service.js
 */
export const calculateSalaryBreakdown = (earnings = [], deductions = [], monthlyCTC = 0, policy = null) => {
  const annualCTC = monthlyCTC * 12;
  const results = {
    earnings: [],
    deductions: [],
    statutoryDeductions: [],
    grossPay: 0,
    totalDeductions: 0,
    netSalary: 0,
    breakdown: {} // Context
  };

  const applyRounding = (val) => Math.round(val * 100) / 100;

  const resolveVal = (comp, base) => {
    let val = parseFloat(comp.value) || 0;
    if (comp.calculationType?.toLowerCase() === 'percentage') {
       val = (base * val) / 100;
    }
    return applyRounding(val);
  };

  // 1. Filter out statutory components from the profile if they are enabled in the policy
  const filterStatutory = (list) => {
    if (!policy?.statutory) return list;
    return list.filter(item => {
      const name = (item.name || '').toLowerCase();
      const isPF = name.includes('provident fund') || name === 'pf';
      const isESI = name.includes('esi') || name.includes('state insurance');
      const isPT = name.includes('professional tax') || name === 'pt';
      const isGratuity = name.includes('gratuity');

      if (isPF && policy.statutory.pf?.enabled) return false;
      if (isESI && policy.statutory.esi?.enabled) return false;
      if (isPT && policy.statutory.pt?.enabled) return false;
      if (isGratuity && policy.statutory.gratuity?.enabled) return false;
      return true;
    });
  };

  const filteredEarnings = filterStatutory(earnings);
  const filteredDeductions = filterStatutory(deductions);

  // Pass 1: Base Components (BasedOn: CTC)
  filteredEarnings.filter(e => !e.basedOn || e.basedOn === 'CTC').forEach(comp => {
    const val = resolveVal(comp, monthlyCTC);
    results.earnings.push({ ...comp, calculatedValue: val });
    results.breakdown[comp.name] = val;
    results.grossPay += val;
  });

  // Pass 2: Dependent Components (BasedOn: Basic, etc.)
  filteredEarnings.filter(e => e.basedOn && e.basedOn !== 'CTC').forEach(comp => {
    const base = results.breakdown[comp.basedOn] || 0;
    const val = resolveVal(comp, base);
    results.earnings.push({ ...comp, calculatedValue: val });
    results.breakdown[comp.name] = val;
    results.grossPay += val;
  });

  results.grossPay = applyRounding(results.grossPay);
  const basicSalary = results.breakdown['Basic Salary'] || results.breakdown['Basic'] || 0;

  // Pass 3: Statutory Deductions (If Policy Enabled) - Match Backend Logic
  if (policy?.statutory) {
    if (policy.statutory.pf?.enabled) {
      const pf = policy.statutory.pf;
      const pfWageBase = Math.min(basicSalary, pf.wageLimit || 15000);
      const pfAmount = applyRounding((pfWageBase * (pf.employeeRate || 12)) / 100);
      results.statutoryDeductions.push({ name: 'Provident Fund (PF)', calculatedValue: pfAmount, isStatutory: true });
      results.totalDeductions += pfAmount;
    }

    if (policy.statutory.esi?.enabled) {
      const esi = policy.statutory.esi;
      if (results.grossPay <= (esi.wageLimit || 21000)) {
        const esiAmount = applyRounding((results.grossPay * (esi.employeeRate || 0.75)) / 100);
        results.statutoryDeductions.push({ name: 'ESI', calculatedValue: esiAmount, isStatutory: true });
        results.totalDeductions += esiAmount;
      }
    }

    if (policy.statutory.pt?.enabled) {
      const pt = policy.statutory.pt;
      // Fixed 200 for simplicity as in backend, unless we have slabs
      const ptAmount = pt.fixedValue || 200;
      results.statutoryDeductions.push({ name: 'Professional Tax (PT)', calculatedValue: ptAmount, isStatutory: true });
      results.totalDeductions += ptAmount;
    }
  }

  // Pass 4: Profile Deductions
  filteredDeductions.forEach(comp => {
    let base = 0;
    if (comp.basedOn === 'CTC') base = monthlyCTC;
    else if (comp.basedOn === 'Gross') base = results.grossPay;
    else if (comp.basedOn === 'Basic Salary' || comp.basedOn === 'Basic') base = basicSalary;
    else base = results.breakdown[comp.basedOn] || 0;

    const val = resolveVal(comp, base);
    results.deductions.push({ ...comp, calculatedValue: val });
    results.totalDeductions += val;
  });

  results.totalDeductions = applyRounding(results.totalDeductions);
  results.netSalary = applyRounding(results.grossPay - results.totalDeductions);

  return results;
};

