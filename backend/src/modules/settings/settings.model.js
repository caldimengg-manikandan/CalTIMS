'use strict';

const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  permissions: {
    approveTimesheets: { type: Boolean, default: false },
    viewReports: { type: Boolean, default: false },
    manageProjects: { type: Boolean, default: false },
    manageEmployees: { type: Boolean, default: false },
    manageSettings: { type: Boolean, default: false },
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
        { name: 'Admin', isSystem: true, permissions: { approveTimesheets: true, viewReports: true, manageProjects: true, manageEmployees: true, manageSettings: true } },
        { name: 'Manager', isSystem: true, permissions: { approveTimesheets: true, viewReports: true, manageProjects: true, manageEmployees: false, manageSettings: false } },
        { name: 'Employee', isSystem: true, permissions: { approveTimesheets: false, viewReports: false, manageProjects: false, manageEmployees: false, manageSettings: false } },
        { name: 'HR', isSystem: true, permissions: { approveTimesheets: false, viewReports: true, manageProjects: false, manageEmployees: true, manageSettings: false } },
        { name: 'Finance', isSystem: true, permissions: { approveTimesheets: false, viewReports: true, manageProjects: false, manageEmployees: false, manageSettings: false } },
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
      // Legacy or background tasks
      timesheetReminder: { type: String, default: 'Friday 18:00' },
      freezeReminder: { type: String, default: 'Monday 15:00' },
      approvalReminder: { type: String, default: 'Daily 10:00' },
    },

    // 6. Reports & Automation (Existing `report`)
    report: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'fortnightly', 'monthly'],
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
      allowAdminOverride: { type: Boolean, default: true },
      requireReasonForLate: { type: Boolean, default: true },
    },

    // 8. Branding & Customization
    branding: {
      systemName: { type: String, default: 'CALTIMS' },
      primaryColor: { type: String, default: '#5A6ACF' },
      logoUrl: { type: String, default: '' },
    },

    // 9. Integrations (mocked)
    integrations: {
      slack: { enabled: { type: Boolean, default: false } },
      teams: { enabled: { type: Boolean, default: false } },
      googleCalendar: { enabled: { type: Boolean, default: false } },
      outlook: { enabled: { type: Boolean, default: false } },
      jira: { enabled: { type: Boolean, default: false } },
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
  },
  {
    timestamps: true,
  }
);

// Singleton: only one settings document per app
const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;
