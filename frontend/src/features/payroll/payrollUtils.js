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
export const calculateSalaryBreakdown = (earnings = [], deductions = [], monthlyCTC = 0) => {
  const annualCTC = monthlyCTC * 12;
  const results = {
    earnings: [],
    deductions: [],
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

  // Pass 1: Base Components (BasedOn: CTC)
  earnings.filter(e => !e.basedOn || e.basedOn === 'CTC').forEach(comp => {
    const val = resolveVal(comp, monthlyCTC);
    results.earnings.push({ ...comp, calculatedValue: val });
    results.breakdown[comp.name] = val;
    results.grossPay += val;
  });

  // Pass 2: Dependent Components (BasedOn: Basic, etc.)
  earnings.filter(e => e.basedOn && e.basedOn !== 'CTC').forEach(comp => {
    const base = results.breakdown[comp.basedOn] || 0;
    const val = resolveVal(comp, base);
    results.earnings.push({ ...comp, calculatedValue: val });
    results.breakdown[comp.name] = val;
    results.grossPay += val;
  });

  results.grossPay = applyRounding(results.grossPay);

  // Pass 3: Deductions (BasedOn: Basic, Gross, Fixed)
  deductions.forEach(comp => {
    let base = 0;
    if (comp.basedOn === 'CTC') base = monthlyCTC;
    else if (comp.basedOn === 'Gross') base = results.grossPay;
    else if (comp.basedOn === 'Basic Salary' || comp.basedOn === 'Basic') base = results.breakdown['Basic Salary'] || results.breakdown['Basic'] || 0;
    else base = results.breakdown[comp.basedOn] || 0;

    const val = resolveVal(comp, base);
    results.deductions.push({ ...comp, calculatedValue: val });
    results.totalDeductions += val;
  });

  results.totalDeductions = applyRounding(results.totalDeductions);
  results.netSalary = applyRounding(results.grossPay - results.totalDeductions);

  return results;
};
