'use strict';

const PLAN_FEATURES = Object.freeze({
  TRIAL: {
    timesheet: true,
    reports: true,
    advanced_reports: false,
    analytics: false,
    incidents: true,
    payroll: false,
    ai: false,
    maxEmployees: 10,
  },
  BASIC: {
    timesheet: true,
    reports: true,
    advanced_reports: false,
    analytics: true,
    incidents: true,
    payroll: false,
    ai: false,
    maxEmployees: 50,
  },
  PRO: {
    timesheet: true,
    reports: true,
    advanced_reports: true,
    analytics: true,
    incidents: true,
    payroll: true,
    ai: true,
    maxEmployees: 1000,
  },
});

module.exports = { PLAN_FEATURES };
