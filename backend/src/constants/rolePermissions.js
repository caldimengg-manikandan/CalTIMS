'use strict';

const ROLE_PERMISSIONS = {
  ADMIN: { all: true, isSuperAdmin: true, 
    'Settings': { 'General': ['view', 'edit'], 'Users & Roles': ['view', 'create', 'edit', 'delete'], 'Audit Logs': ['view'] },
    'Announcements': { Announcements: ['view', 'create', 'edit'] },
    'Projects': { 'Project List': ['view', 'create', 'edit', 'delete'] }
  },
  MANAGER: {
    'Timesheets': { Dashboard: ['view'], Entry: ['view', 'create', 'edit'], History: ['view'], Management: ['view', 'approve', 'reject'] },
    'Leave Management': { 'Leave Tracker': ['view'] },
    'My Payslip': { 'Payslip View': ['view', 'download'] },
    'Payroll': { 'Execution Ledger': ['view'] },
    'Support': { 'Help & Support': ['view'] },
    'Settings': { 'General': ['view'] },
    'Projects': { 'Project List': ['view'] }
  },
  HR: {
    'Payroll': { Dashboard: ['view'], 'Payroll Engine': ['view', 'run', 'submit'], 'Execution Ledger': ['view'], 'Payslip Generation': ['view', 'generate'], 'Payroll Reports': ['view'] },
    'Employees': { 'Employee List': ['view', 'create', 'edit', 'delete'], Management: ['view', 'edit'] },
    'Leave Management': { 'Leave Tracker': ['view'], 'Leave Requests': ['view', 'create', 'approve', 'reject'], 'Leave Policies': ['view', 'edit'] },
    'Timesheets': { Dashboard: ['view'], Entry: ['view', 'create', 'edit'], History: ['view'], Management: ['view', 'approve', 'reject', 'lock'] },
    'Announcements': { Announcements: ['view', 'create', 'edit'] },
    'Support': { 'Help & Support': ['view'] },
    'Settings': { 'General': ['view', 'edit'], 'Users & Roles': ['view', 'create', 'edit', 'delete'] },
    'Projects': { 'Project List': ['view', 'edit'] }
  },
  FINANCE: {
    'Payroll': { Dashboard: ['view'], 'Payroll Engine': ['view', 'approve', 'disburse'], 'Execution Ledger': ['view'], 'Bank Export': ['view', 'export'], 'Payroll Reports': ['view', 'export'] },
    'Reports': { 'Reports Dashboard': ['view', 'export'] },
    'My Payslip': { 'Payslip View': ['view', 'download'] }
  },
  EMPLOYEE: {
    'Timesheets': { Dashboard: ['view'], Entry: ['view', 'create', 'edit'], History: ['view'] },
    'Leave Management': { 'Leave Tracker': ['view'] },
    'My Payslip': { 'Payslip View': ['view', 'download'] },
    'Support': { 'Help & Support': ['view'] }
  }
};

module.exports = {
  ROLE_PERMISSIONS
};
