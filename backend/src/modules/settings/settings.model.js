'use strict';

const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true
    },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  templateType: { 
    type: String, 
  },
  permissions: {
    type: Object, // Hierarchical: { Module: { Submodule: [Actions] } }
    default: {},
  },
  isSystem: { type: Boolean, default: false } // Admin, Manager, Employee, HR can be system default roles
});

const settingsSchema = new mongoose.Schema(
  {
    // 1. Organization Settings
    organization: {
      companyName: { type: String, default: 'CALTIMS' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD/MM/YYYY' },
      companyLogo: { type: String, default: '' },
      address: { type: String, default: '' },
      country: { type: String, default: '' },
      currency: { type: String, default: 'INR' },
      fiscalYearStart: { type: String, default: 'April' },
      workWeek: { type: String, enum: ['Mon-Fri', 'Sun-Thu'], default: 'Mon-Fri' },
    },

    // 2. Users & Roles (Custom Roles embedded for simplicity)
    roles: {
      type: [roleSchema],
      default: [
        { name: 'Admin', isSystem: true, permissions: {} },
        { name: 'Manager', isSystem: true, permissions: {} },
        { name: 'Employee', isSystem: true, permissions: {} },
        { name: 'HR', isSystem: true, permissions: {} },
        { name: 'Finance', isSystem: true, permissions: {} },
      ]
    },

    // 3. Timesheet Policy Settings (Merging existing timesheet settings)
    timesheet: {
      taskCategories: {
        type: [String],
        default: ['Development', 'Bug Fixing', 'Design', 'Meeting', 'Documentation', 'Testing'],
      },
      submissionDeadline: { type: String, default: 'Friday 18:00' }, // Day Time string
      freezeTimesheet: { type: String, default: 'Monday 18:00' },
      allowEditAfterSubmission: { type: Boolean, default: false },
      managerApprovalRequired: { type: Boolean, default: true },
      minHoursPerDay: { type: Number, default: 4 },
      maxHoursPerDay: { type: Number, default: 12 },
      enforceMinHoursOnSubmit: { type: Boolean, default: false },
      // Permission Log limits
      permissionMaxHoursPerDay: { type: Number, default: 2 },
      permissionMaxDaysPerWeek: { type: Number, default: 1 },
      permissionMaxDaysPerMonth: { type: Number, default: 4 },
    },

    // 4. Leave Policy Settings (Existing properties + new)
    leavePolicy: {
      leaveTypes: {
        type: [String],
        default: ['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Paternity'],
      },
      eligibleLeaveTypes: {
        type: [String],
        default: ['annual', 'sick', 'casual'],
      },
      annualLeaveDays: { type: Number, default: 20 },
      sickLeaveDays: { type: Number, default: 10 },
      casualLeaveDays: { type: Number, default: 6 },
      maxCarryForward: { type: Number, default: 5 },
      approvalWorkflow: { type: String, enum: ['Employee -> Manager', 'Employee -> Manager -> HR'], default: 'Employee -> Manager' }
    },

    // 5. Notification Settings
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      inAppEnabled: { type: Boolean, default: true },
      notifyOnTimesheetSubmission: { type: Boolean, default: true },
      notifyOnTimesheetApproval: { type: Boolean, default: true },
      notifyOnTimesheetRejection: { type: Boolean, default: true },
      notifyOnLeaveRequest: { type: Boolean, default: true },
      notifyOnLeaveApproval: { type: Boolean, default: true },
      notifyOnLeaveRejection: { type: Boolean, default: true },
      notifyOnSupportTicket: { type: Boolean, default: true },
      // Legacy or background tasks
      timesheetReminder: { type: String, default: 'Friday 18:00' },
      freezeReminder: { type: String, default: 'Monday 15:00' },
      approvalReminder: { type: String, default: 'Daily 10:00' },
    },

    // 6. Reports & Automation (Existing `report`)
    report: {
      defaultFormat: { type: String, enum: ['PDF', 'Excel', 'CSV'], default: 'PDF' },
      autoSchedule: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'fortnightly', 'monthly', 'Daily', 'Weekly', 'Fortnightly', 'Monthly'],
        default: 'weekly',
      },
      reportType: {
        type: String,
        enum: ['mh_requests', 'approved', 'implemented', 'rejected'],
        default: 'approved',
      },
      scheduledTime: { type: String, default: '09:00' },
      recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
      isActive: { type: Boolean, default: false },
      lastSentAt: { type: Date, default: null },
      managerReportSchedule: { type: String, default: 'Friday 17:00' },
      productivityReportSchedule: { type: String, default: '1st of month' },
      exportFormats: { type: [String], default: ['PDF', 'Excel', 'CSV'] }
    },

    // 7. Compliance & Lock Rules
    compliance: {
      autoFreezeTimesheets: { type: String, default: 'Monday 18:00' },
      timesheetFreezeDay: { type: Number, default: 28 },
      allowBackdatedEntries: { type: Boolean, default: false },
      auditLogRetentionDays: { type: Number, default: 365 },
      allowAdminOverride: { type: Boolean, default: true },
      requireReasonForLate: { type: Boolean, default: true },
    },

    // 8. Branding & Customization
    branding: {
      organizationName: { type: String, default: 'CALTIMS' },
      tagline: { type: String, default: 'TimeSheet Management System' },
      primaryColor: { type: String, default: '#5A6ACF' },
      secondaryColor: { type: String, default: '#6366f1' },
      logoUrl: { type: String, default: '' },
      faviconUrl: { type: String, default: '' },
    },

    // 9. Integrations
    integrations: {
      googleCalendar: { 
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: '' }
      },
      microsoftOutlook: { 
        enabled: { type: Boolean, default: false },
        apiKey: { type: String, default: '' }
      },
      slackNotifications: { 
        enabled: { type: Boolean, default: false },
        webhookUrl: { type: String, default: '' }
      }
    },

    // 10. Hardware Gateways
    hardwareGateways: {
      hikvision: {
        enabled: { type: Boolean, default: false },
        ipAddress: { type: String, default: '' },
        host: { type: String, default: '' },
        port: { type: String, default: '8000' },
        appKey: { type: String, default: '' },
        appSecret: { type: String, default: '' },
        username: { type: String, default: '' },
        password: { type: String, default: '' }
      },
      zkTeco: {
        enabled: { type: Boolean, default: false },
        ipAddress: { type: String, default: '' },
        port: { type: String, default: '4370' }
      }
    },

    // 11. Payroll Settings
    payroll: {
      payrollMode: { type: String, enum: ['Role-Based', 'Employee-Based'], default: 'Employee-Based' },
      calculationBasis: { type: String, enum: ['Monthly', 'Yearly', 'Hourly', 'Weekly'], default: 'Monthly' },
      defaultPaymentType: { type: String, enum: ['Monthly', 'Hourly'], default: 'Monthly' },
      payslipHeader: { type: String, default: 'CALTIMS' },
      payslipFooter: { type: String, default: 'This is a computer-generated payslip.' },
      lopCalculationBasis: { type: String, enum: ['Standard (30 days)', 'Working Days'], default: 'Standard (30 days)' },
      workingDaysPerMonth: { type: Number, default: 22 },
      overtimeEnabled: { type: Boolean, default: false },
      overtimeRate: { type: Number, default: 1.5 },
      professionalTaxMonths: { type: [String], default: ['May', 'September'] },
      esiLimit: { type: Number, default: 21000 },
      esiRate: { type: Number, default: 0.75 }, // Employee contribution %
      pfRate: { type: Number, default: 12 }, // Employee contribution %
      taxToggles: {
          pf: { type: Boolean, default: true },
          esi: { type: Boolean, default: true },
          tds: { type: Boolean, default: true }
      },
      tdsThreshold: { type: Number, default: 50000 },
      // Dynamic Tax Slabs for TDS (Income Tax)
      taxSlabs: {
        type: [{
          min: Number,
          max: Number,
          rate: Number // Percentage
        }],
        default: [
          { min: 0, max: 250000, rate: 0 },
          { min: 250001, max: 500000, rate: 5 },
          { min: 500001, max: 1000000, rate: 20 },
          { min: 1000001, max: 999999999, rate: 30 }
        ]
      },
      autoLockPayroll: { type: Boolean, default: false },
      autoProcessingDay: { type: Number, default: 1 },
      payslipTemplateUrl: { type: String, default: '' },
      payslipTemplateType: { type: String, enum: ['PDF', 'HTML', 'Default'], default: 'Default' },
      currencySymbol: { type: String, default: '₹' },
      
      // Compliance Upgrades
      taxRegime: { type: String, enum: ['OLD', 'NEW'], default: 'OLD' },
      standardDeduction: { type: Number, default: 50000 },
      pfWageLimit: { type: Number, default: 15000 },
      pfEmployerRate: { type: Number, default: 12 },
      esiEmployerRate: { type: Number, default: 3.25 },
      country: { type: String, default: 'India' },
      
      // Policy Versioning (FY based)
      policies: {
        type: [{
          fy: String, // e.g., "2024-25"
          version: Number,
          regime: String,
          slabs: [{ min: Number, max: Number, rate: Number }],
          pfRate: Number,
          pfEmployerRate: Number,
          esiRate: Number,
          esiEmployerRate: Number,
          standardDeduction: Number,
          isActive: { type: Boolean, default: true }
        }],
        default: []
      }
    },

    // (Kept for backwards compatibility with previous endpoints if any components still rely on it directly)
    general: {
      companyName: { type: String, default: 'CALTIMS' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      workingHoursPerDay: { type: Number, default: 8, min: 1, max: 24 },
      strictDailyHours: { type: Boolean, default: false },
      isWeekendWorkable: { type: Boolean, default: false },
      weekStartDay: { type: String, enum: ['monday', 'sunday'], default: 'monday' },
      dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD/MM/YYYY' },
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true
    },
  },
  {
    timestamps: true,
  }
);

/* 
 * Multi-tenant Settings: Each organization has its own settings document.
 * Enforced by unique index on organizationId above.
 */
const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;
