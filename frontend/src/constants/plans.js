export const PLAN_FEATURES = Object.freeze({
  TRIAL: {
    timesheets: true,
    reports: true,
    advanced_reports: true,
    analytics: true,
    support: true, // Help & Support
    payroll: true,
    leave_management: true,
    payslips: true,
    audit_logs: true,
    ai: true,
    maxEmployees: 10,
  },
  BASIC: {
    timesheets: true,
    reports: true,
    advanced_reports: false,
    analytics: true,
    support: true,
    payroll: false,
    leave_management: true,
    payslips: true,
    audit_logs: true,
    ai: false,
    maxEmployees: 50,
  },
  PRO: {
    timesheets: true,
    reports: true,
    advanced_reports: true,
    analytics: true,
    support: true,
    payroll: true,
    leave_management: true,
    payslips: true,
    audit_logs: true,
    ai: true,
    maxEmployees: 1000,
  },
});

export const FEATURE_KEYS = {
    TIMESHEETS: 'timesheets',
    REPORTS: 'reports',
    ADVANCED_REPORTS: 'advanced_reports',
    ANALYTICS: 'analytics',
    SUPPORT: 'support',
    PAYROLL: 'payroll',
    LEAVE_MANAGEMENT: 'leave_management',
    PAYSLIPS: 'payslips',
    AUDIT_LOGS: 'audit_logs',
    AI: 'ai'
};
