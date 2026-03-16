'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const Settings = require('./settings.model');
const User = require('../users/user.model');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');
const emailService = require('../../shared/services/email.service');
const { logAction } = require('../audit/audit.routes');
const upload = require('../../middleware/upload.middleware');
const net = require('net');

router.use(authenticate);

// Write-only operations restricted to admin/manager.
// GET routes below are accessible to ALL authenticated users (employees included).

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getOrCreateSettings() {
  let s = await Settings.findOne();
  if (!s) {
    s = await Settings.create({});
  }

  // Heal settings: If new permissions were added to the schema but are missing in the DB
  const defaultRoles = Settings.schema.path('roles').options.default;
  let needsSync = false;

  s.roles.forEach((role, idx) => {
    if (role.isSystem) {
      const defaultRole = defaultRoles.find(dr => dr.name === role.name);
      if (defaultRole) {
        // Find if any default permission is missing in the current role
        for (const [perm, val] of Object.entries(defaultRole.permissions)) {
          if (role.permissions[perm] === undefined) {
            role.permissions[perm] = val;
            needsSync = true;
          }
        }
      }
    }
  });

  if (needsSync) {
    s.markModified('roles');
    await s.save();
  }

  return s.toObject();
}

// ════════════════════════════════════════════════════════════════════════════
// FULL SYSTEM SETTINGS (Enterprise Suite)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/v1/settings
router.get('/', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();

  // Optionally populate recipients
  if (settings.report?.recipientIds?.length) {
    settings.report.recipients = await User.find(
      { _id: { $in: settings.report.recipientIds } },
      'name email employeeId'
    ).lean();
  }

  ApiResponse.success(res, { data: settings });
}));

// PUT /api/v1/settings
router.put('/', checkPermission('manageSettings'), asyncHandler(async (req, res) => {
  const updates = req.body;
  const currentSettings = await getOrCreateSettings();

  // Basic flat-map updater. Real deep merge relies on Mongoose's `set` logic or lodash.merge
  // Since we construct the form fully on frontend, we can just replace whole sub-documents
  // if provided, except keeping their `_id`s if necessary.

  // Safe keys to update
  const safeKeys = [
    'organization', 'timesheet', 'leavePolicy', 'notifications',
    'report', 'compliance', 'branding', 'integrations', 'hardwareGateways', 'general', 'roles'
  ];

  const updateDoc = {};
  for (const key of safeKeys) {
    if (updates[key] !== undefined) {
      updateDoc[key] = updates[key];
    }
  }

  // Update
  const newSettings = await Settings.findOneAndUpdate(
    {},
    { $set: updateDoc },
    { upsert: true, new: true }
  ).lean();

  // ─── Synchronize Leave Policy to All Users ──────────────────────────────────
  if (updateDoc.leavePolicy) {
    const { annualLeaveDays, sickLeaveDays, casualLeaveDays, eligibleLeaveTypes } = updateDoc.leavePolicy;
    const updatePromises = [];

    // 1. Update standard allowances if they changed
    const userUpdates = {};
    if (annualLeaveDays !== undefined) userUpdates['leaveBalance.annual'] = annualLeaveDays;
    if (sickLeaveDays !== undefined) userUpdates['leaveBalance.sick'] = sickLeaveDays;
    if (casualLeaveDays !== undefined) userUpdates['leaveBalance.casual'] = casualLeaveDays;

    if (Object.keys(userUpdates).length > 0) {
      updatePromises.push(User.updateMany({ isActive: true }, { $set: userUpdates }));
    }

    // 2. Ensure all eligible types exist in user balance maps
    if (eligibleLeaveTypes && eligibleLeaveTypes.length > 0) {
      for (const type of eligibleLeaveTypes) {
        const lowerType = type.toLowerCase();
        // If the field doesn't exist, set it to 0
        updatePromises.push(User.updateMany(
          { isActive: true, [`leaveBalance.${lowerType}`]: { $exists: false } },
          { $set: { [`leaveBalance.${lowerType}`]: 0 } }
        ));
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
  }

  // Audit Log
  await logAction({
    userId: req.user._id,
    action: 'UPDATE_SETTINGS',
    entityType: 'Settings',
    details: { updatedSections: Object.keys(updateDoc) },
    ipAddress: req.ip || req.connection.remoteAddress
  });

  ApiResponse.success(res, { message: 'Settings successfully updated', data: newSettings });
}));

// POST /api/v1/settings/test-hikvision
router.post('/test-hikvision', checkPermission('manageSettings'), asyncHandler(async (req, res) => {
  const { ipAddress, port, username, password, host, appKey, appSecret } = req.body;
  
  const targetHost = host || ipAddress;
  if (!targetHost) {
    return ApiResponse.error(res, { message: 'Host/IP Address is required', statusCode: 400 });
  }

  // If host is a full URL, extract hostname
  let hostname = targetHost;
  try {
    if (targetHost.startsWith('http')) {
      const urlObj = new URL(targetHost);
      hostname = urlObj.hostname;
    }
  } catch (e) {}

  const targetPort = parseInt(port) || 8000;
  const timeout = 5000; 

  // Basic TCP socket test
  const checkConnection = () => {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.connect(targetPort, hostname, () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timed out'));
      });
    });
  };

  try {
    await checkConnection();
    ApiResponse.success(res, { message: `Successfully connected to Hikvision/HikCentral at ${hostname}:${targetPort}` });
  } catch (err) {
    ApiResponse.error(res, { 
      message: `Failed to connect at ${hostname}:${targetPort}. Error: ${err.message}`, 
      statusCode: 200 
    });
  }
}));

// POST /api/v1/settings/upload-branding
router.post('/upload-branding', checkPermission('manageSettings'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return ApiResponse.error(res, { message: 'No file uploaded', statusCode: 400 });
  }

  // Construct the URL. In a real app this might be a CDN or S3 bucket.
  // Here we use the server's own address.
  const protocol = req.protocol;
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/uploads/branding/${req.file.filename}`;

  ApiResponse.success(res, { 
    message: 'File uploaded successfully', 
    data: { url: fileUrl } 
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// REPORT SETTINGS (Legacy)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/v1/settings/report
router.get('/report', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();

  // Populate recipient details
  let recipients = [];
  if (settings.report?.recipientIds?.length) {
    recipients = await User.find(
      { _id: { $in: settings.report.recipientIds } },
      'name email employeeId'
    ).lean();
  }

  ApiResponse.success(res, {
    data: { ...settings.report, recipients },
  });
}));

// POST /api/v1/settings/report
router.post('/report', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { frequency, reportType, recipientIds, isActive, projectIds } = req.body;

  const settings = await Settings.findOneAndUpdate(
    {},
    {
      $set: {
        'report.frequency': frequency,
        'report.reportType': reportType,
        'report.scheduledTime': req.body.scheduledTime || '09:00',
        'report.recipientIds': recipientIds || [],
        'report.projectIds': projectIds || [],
        'report.isActive': isActive ?? false,
      },
    },
    { upsert: true, new: true }
  ).lean();

  ApiResponse.success(res, { message: 'Report settings saved', data: settings.report });
}));

// POST /api/v1/settings/report/send-now
router.post('/report/send-now', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const { reportType: savedType, recipientIds: savedIds, projectIds: savedProjIds } = settings.report || {};

  const ids = req.body.recipientIds || savedIds || [];
  const type = req.body.reportType || savedType || 'approved';
  const projectIds = req.body.projectIds || savedProjIds || [];

  if (!ids.length) {
    return ApiResponse.error(res, { message: 'No recipients configured. Please select at least one recipient.', statusCode: 400 });
  }

  // Fetch recipient emails
  const users = await User.find({ _id: { $in: ids } }, 'email name').lean();
  const emails = users.map(u => u.email).filter(Boolean);

  if (!emails.length) {
    return ApiResponse.error(res, { message: 'No valid email addresses found for selected recipients.', statusCode: 400 });
  }

  // Get company name and format
  const companyName = settings.general?.companyName || 'TimesheetPro';
  const format = settings.report?.defaultFormat || 'PDF';

  let result;
  try {
    result = await emailService.sendReportEmail(emails, type, companyName, projectIds, format);
  } catch (smtpErr) {
    return ApiResponse.error(res, {
      message: smtpErr.message.includes('SMTP')
        ? 'Email not sent: SMTP credentials are not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to the backend .env file.'
        : `Email failed: ${smtpErr.message}`,
      statusCode: 400,
    });
  }

  // Update lastSentAt
  await Settings.updateOne({}, { $set: { 'report.lastSentAt': new Date() } });

  ApiResponse.success(res, { message: `Report sent to ${result.sent} recipient(s)`, data: result });
}));

// POST /api/v1/settings/report/preview
router.post('/report/preview', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const reportType = req.body.reportType || settings.report?.reportType || 'approved';
  const projectIds = req.body.projectIds || settings.report?.projectIds || [];
  const companyName = settings.general?.companyName || 'TimesheetPro';

  try {
    const preview = await emailService.buildPreview(reportType, companyName, projectIds);
    ApiResponse.success(res, { data: preview });
  } catch (err) {
    ApiResponse.error(res, { message: `Preview failed: ${err.message}`, statusCode: 500 });
  }
}));

// ════════════════════════════════════════════════════════════════════════════
// TIMESHEET SETTINGS (Task Categories & Leave Types)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/v1/settings/timesheet
router.get('/timesheet', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  ApiResponse.success(res, { 
    data: { 
      ...settings.timesheet,
      leaveTypes: settings.leavePolicy?.leaveTypes || [],
      eligibleLeaveTypes: settings.leavePolicy?.eligibleLeaveTypes || []
    } 
  });
}));

// POST /api/v1/settings/timesheet
router.post('/timesheet', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const {
    taskCategories, leaveTypes, eligibleLeaveTypes,
    maxEntriesPerDay, maxEntriesPerWeek,
    permissionMaxHoursPerDay, permissionMaxDaysPerWeek, permissionMaxDaysPerMonth
  } = req.body;

  const settings = await Settings.findOneAndUpdate(
    {},
    {
      $set: {
        ...(taskCategories && { 'timesheet.taskCategories': taskCategories }),
        ...(leaveTypes && { 'leavePolicy.leaveTypes': leaveTypes }),
        ...(eligibleLeaveTypes && { 'leavePolicy.eligibleLeaveTypes': eligibleLeaveTypes }),
        ...(maxEntriesPerDay !== undefined && { 'timesheet.maxEntriesPerDay': maxEntriesPerDay }),
        ...(maxEntriesPerWeek !== undefined && { 'timesheet.maxEntriesPerWeek': maxEntriesPerWeek }),
        ...(permissionMaxHoursPerDay !== undefined && { 'timesheet.permissionMaxHoursPerDay': permissionMaxHoursPerDay }),
        ...(permissionMaxDaysPerWeek !== undefined && { 'timesheet.permissionMaxDaysPerWeek': permissionMaxDaysPerWeek }),
        ...(permissionMaxDaysPerMonth !== undefined && { 'timesheet.permissionMaxDaysPerMonth': permissionMaxDaysPerMonth }),
      },
    },
    { upsert: true, new: true }
  ).lean();

  ApiResponse.success(res, { 
    message: 'Timesheet settings saved', 
    data: { 
      ...settings.timesheet,
      leaveTypes: settings.leavePolicy?.leaveTypes || [],
      eligibleLeaveTypes: settings.leavePolicy?.eligibleLeaveTypes || []
    } 
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GENERAL SETTINGS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/v1/settings/general
router.get('/general', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  ApiResponse.success(res, { data: settings.general });
}));

// POST /api/v1/settings/general
router.post('/general', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { companyName, timezone, workingHoursPerDay, strictDailyHours, isWeekendWorkable, weekStartDay, dateFormat } = req.body;

  const settings = await Settings.findOneAndUpdate(
    {},
    {
      $set: {
        ...(companyName !== undefined && { 'general.companyName': companyName }),
        ...(timezone !== undefined && { 'general.timezone': timezone }),
        ...(workingHoursPerDay !== undefined && { 'general.workingHoursPerDay': workingHoursPerDay }),
        ...(strictDailyHours !== undefined && { 'general.strictDailyHours': strictDailyHours }),
        ...(isWeekendWorkable !== undefined && { 'general.isWeekendWorkable': isWeekendWorkable }),
        ...(weekStartDay !== undefined && { 'general.weekStartDay': weekStartDay }),
        ...(dateFormat !== undefined && { 'general.dateFormat': dateFormat }),
      },
    },
    { upsert: true, new: true }
  ).lean();

  ApiResponse.success(res, { message: 'General settings saved', data: settings.general });
}));

// ── All employees list (for recipient picker) — admin/manager only ──────────
router.get('/employees', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  const filter = { isActive: true };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }
  const users = await User.find(filter, 'name email employeeId').sort({ name: 1 }).limit(100).lean();
  ApiResponse.success(res, { data: users });
}));

module.exports = router;
