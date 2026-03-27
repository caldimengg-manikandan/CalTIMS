const { evaluateFormula, evaluateCondition, validateFormula } = require('./evaluator');

/**
 * Builds the execution context for salary formulations securely.
 */
function buildPayrollContext(user, payrollProfile, attendanceMetrics, config = {}) {
    return {
        // Financial Anchors
        CTC: Number(payrollProfile?.monthlyCTC) || 0,
        BASIC: 0, // Computed dynamically
        GROSS: 0, // Computed dynamically
        
        // Attendance Variables
        WORKED_DAYS: attendanceMetrics?.workedDays || 0,
        PAYABLE_DAYS: attendanceMetrics?.payableDays || 0,
        LOP_DAYS: attendanceMetrics?.lopDays || 0,
        TOTAL_HOURS: attendanceMetrics?.totalHours || 0,
        OVERTIME_HOURS: attendanceMetrics?.overtimeHours || 0,
        
        // User Attributes for Conditional Rules
        department: user?.department || '',
        designation: user?.designation || '',
        role: user?.role || '',
        experience: user?.experienceYears || 0,
        gender: user?.gender || '',
        employmentType: payrollProfile?.employeeType || 'Permanent',
        
        // Configuration Context
        config: config
    };
}

module.exports = {
    evaluateFormula,
    evaluateCondition,
    validateFormula,
    buildPayrollContext
};
