'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');
const emailService = require('../../shared/services/email.service');
const { logAction } = require('../audit/audit.routes');
const upload = require('../../middleware/upload.middleware');
const net = require('net');
const policyService = require('../policyEngine/policy.service');
const { ROLE_PERMISSIONS } = require('../../constants');

router.use(authenticate);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getOrgId(req) {
  return req.user?.organizationId;
}

/**
 * Calculates differences between two role sets for auditing
 */
function diffRoles(oldRoles = [], newRoles = []) {
  const changes = [];
  const oldMap = new Map(oldRoles.map(r => [r.name, r]));
  const newMap = new Map(newRoles.map(r => [r.name, r]));

  // Check for deletions and updates
  oldRoles.forEach(oldRole => {
    const newRole = newMap.get(oldRole.name);
    if (!newRole) {
      changes.push({ action: 'DELETE_ROLE', roleName: oldRole.name, details: { previous: oldRole } });
    } else {
      // Check for permission changes
      const diffs = [];
      const oldPerms = oldRole.permissions || {};
      const newPerms = newRole.permissions || {};

      const allModules = new Set([...Object.keys(oldPerms), ...Object.keys(newPerms)]);
      allModules.forEach(mod => {
        const oldMod = oldPerms[mod] || {};
        const newMod = newPerms[mod] || {};
        const allSubs = new Set([...Object.keys(oldMod), ...Object.keys(newMod)]);
        
        allSubs.forEach(sub => {
          const oldActs = oldMod[sub] || [];
          const newActs = newMod[sub] || [];
          const allActs = new Set([...oldActs, ...newActs]);
          
          allActs.forEach(act => {
            const wasGranted = oldActs.includes(act);
            const isGranted = newActs.includes(act);
            if (wasGranted !== isGranted) {
              diffs.push({ module: mod, submodule: sub, action: act, previous: wasGranted, current: isGranted });
            }
          });
        });
      });

      if (diffs.length > 0) {
        changes.push({ action: 'UPDATE_PERMISSION', roleName: oldRole.name, details: { changes: diffs } });
      }
    }
  });

  // Check for creations
  newRoles.forEach(newRole => {
    if (!oldMap.has(newRole.name)) {
      changes.push({ action: 'CREATE_ROLE', roleName: newRole.name, details: { current: newRole } });
    }
  });

  return changes;
}

async function getOrCreateSettings(organizationId) {
  if (!organizationId) return {};

  const defaultRoles = [
    { name: 'Admin', isSystem: true, permissions: ROLE_PERMISSIONS.ADMIN },
    { name: 'HR', isSystem: true, permissions: ROLE_PERMISSIONS.HR },
    { name: 'Finance', isSystem: true, permissions: { 
        "Payroll": { "Dashboard": ["view"], "Payroll Engine": ["view", "approve", "disburse"], "Bank Export": ["view", "export"], "Payroll Reports": ["view", "export"] },
        "Reports": { "Reports Dashboard": ["view", "export"] },
        "My Payslip": { "Payslip View": ["view", "download"] }
      } 
    },
    { name: 'Manager', isSystem: true, permissions: ROLE_PERMISSIONS.MANAGER },
    { name: 'Employee', isSystem: true, permissions: ROLE_PERMISSIONS.EMPLOYEE }
  ];

  let s = await prisma.orgSettings.findUnique({ where: { organizationId } });
  if (!s) {
    s = await prisma.orgSettings.create({
      data: { 
        organizationId, 
        data: { 
          organization: {}, branding: {}, timesheet: {}, leavePolicy: {}, 
          notifications: {}, report: {}, compliance: {}, integrations: {}, 
          hardwareGateways: {}, payroll: {}, general: {}, 
          roles: defaultRoles 
        } 
      },
    });
  }

  // Ensure system roles exist in the Role table without overwriting customizations
  for (const role of defaultRoles) {
    const existingRole = await prisma.role.findFirst({
      where: { name: role.name, organizationId, isDeleted: false }
    });

    if (!existingRole) {
      console.log(`Initial seeding for role: ${role.name}`);
      const roleId = `sys-${role.name.toLowerCase().replace(/\s+/g, '-')}-${organizationId}`;
      await prisma.role.create({
        data: {
          id: roleId,
          organization: { connect: { id: organizationId } },
          name: role.name,
          permissions: role.permissions,
          isActive: true,
          isSystem: true
        }
      }).catch(e => console.error(`Failed to seed role ${role.name}:`, e.message));
    }
  }

  // Fetch current roles from Role table to ensure they have IDs and latest data
  const dbRoles = await prisma.role.findMany({ where: { organizationId, isDeleted: false } });
  const data = s.data || {};
  
  // Re-map dbRoles into settings
  data.roles = dbRoles.map(r => ({ ...r, id: r.id })); 
  
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/v1/settings
// ════════════════════════════════════════════════════════════════════════════
router.get('/', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const settings = await getOrCreateSettings(orgId);

  // Populate recipients on report section
  if (settings?.report?.recipientIds?.length) {
    settings.report.recipients = await prisma.user.findMany({
      where: { id: { in: settings.report.recipientIds } },
      select: { id: true, name: true, email: true },
    });
  }

  ApiResponse.success(res, { data: settings });
}));

// PUT /api/v1/settings
router.put('/', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const updates = req.body;
  const currentSettings = await getOrCreateSettings(orgId);

  const safeKeys = ['organization', 'timesheet', 'leavePolicy', 'notifications', 'report', 'compliance', 'branding', 'integrations', 'hardwareGateways', 'general', 'roles', 'payroll', 'onboarding'];
  const merged = { ...currentSettings };
  for (const key of safeKeys) {
    if (updates[key] !== undefined) merged[key] = updates[key];
  }

  // 1. Audit Role Changes
  if (updates.roles && Array.isArray(updates.roles)) {
    const roleChanges = diffRoles(currentSettings.roles || [], updates.roles);
    if (roleChanges.length > 0) {
      await prisma.permissionAuditLog.createMany({
        data: roleChanges.map(c => ({
          organizationId: orgId,
          changedById: req.user.id,
          action: c.action,
          details: c,
        })),
      }).catch(e => console.error('Failed to log role changes:', e.message));
    }

    const syncedRoles = [];
    const incomingRoleIds = updates.roles.map(r => r.id).filter(Boolean);

    // 2. Synchronize Role Table
    for (const rd of updates.roles) {
      // Find by ID or Name
      let existingRole = null;
      if (rd.id) {
        existingRole = await prisma.role.findFirst({ where: { id: rd.id, organizationId: orgId } });
      }
      
      if (!existingRole) {
        existingRole = await prisma.role.findFirst({ where: { name: { equals: rd.name, mode: 'insensitive' }, organizationId: orgId } });
      }

      const rolePayload = { 
        organization: { connect: { id: orgId } },
        name: rd.name, 
        permissions: rd.permissions || {}, 
        isSystem: rd.isSystem || false,
        isActive: true,
        isDeleted: false
      };
      
      let savedRole;
      if (existingRole) {
        savedRole = await prisma.role.update({ where: { id: existingRole.id }, data: rolePayload });
      } else {
        savedRole = await prisma.role.create({ data: { ...rolePayload, id: rd.id || undefined } });
      }
      syncedRoles.push({ ...rd, id: savedRole.id });
    }

    // 3. Mark Roles not in the updates as DELETED
    const finalRoleIds = syncedRoles.map(r => r.id);
    await prisma.role.updateMany({
      where: { 
        organizationId: orgId, 
        id: { notIn: finalRoleIds },
        isSystem: false // Never auto-delete system roles
      },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() }
    });

    merged.roles = syncedRoles;
  }

  // 4. Save to OrgSettings JSON blob
  if (updates.timesheet && updates.timesheet.enforceMinHoursOnSubmit === true && !currentSettings.timesheet?.enforceMinHoursOnSubmit) {
    merged.timesheet.enforceMinHoursEnabledAt = new Date();
  }

  const updated = await prisma.orgSettings.upsert({
    where: { organizationId: orgId },
    update: { data: merged, updatedAt: new Date() },
    create: { organizationId: orgId, data: merged },
  });

  // 5. Sync leavePolicy to LeaveTypes
  if (updates.leavePolicy?.config && Array.isArray(updates.leavePolicy.config)) {
    for (const ltConfig of updates.leavePolicy.config) {
      const { name, days, category } = ltConfig;
      const isDeductible = category === 'Paid' || category === 'Medical';
      
      await prisma.leaveType.upsert({
        where: { organizationId_name: { organizationId: orgId, name } },
        update: { yearlyQuota: parseFloat(days) || 0, isDeductible },
        create: { organizationId: orgId, name, yearlyQuota: parseFloat(days) || 0, isDeductible },
      });
    }

    // Ensure LOP exists as a system default if not already there
    await prisma.leaveType.upsert({
      where: { organizationId_name: { organizationId: orgId, name: 'Loss of Pay' } },
      update: { isDeductible: false, yearlyQuota: 0 },
      create: { organizationId: orgId, name: 'Loss of Pay', yearlyQuota: 0, isDeductible: false },
    });
  }

  if (logAction) {
    // Build a human-readable before/after diff of what changed
    const beforeSnap = {};
    const afterSnap  = {};
    for (const key of Object.keys(updates)) {
      if (key === 'roles') continue; // roles have their own granular audit via permissionAuditLog
      const prev = currentSettings[key];
      const next = updates[key];
      // Only include sections that actually changed
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        beforeSnap[key] = prev ?? null;
        afterSnap[key]  = next ?? null;
      }
    }
    await logAction({
      userId: req.user.id,
      action: 'UPDATE_SETTINGS',
      entityType: 'Settings',
      details: {
        updatedSections: Object.keys(updates),
        message: `Updated settings: ${Object.keys(afterSnap).join(', ') || Object.keys(updates).join(', ')}`,
        before: Object.keys(beforeSnap).length > 0 ? beforeSnap : undefined,
        after:  Object.keys(afterSnap).length  > 0 ? afterSnap  : undefined,
      },
      organizationId: orgId,
      ipAddress: req.ip,
    });
  }

  // 6. Sync Compliance to PayrollPolicy if updated
  if (updates.compliance) {
    const activePolicy = await policyService.getPolicy(orgId);
    if (activePolicy && activePolicy.id) {
       await policyService.updatePolicy({
         compliance: {
           ...(activePolicy.compliance || {}),
           ...updates.compliance
         }
       }, orgId).catch(e => console.error('Failed to sync compliance to payroll policy:', e.message));
    }
  }

  // 7. Sync Payroll section to PayrollPolicy if updated
  if (updates.payroll) {
    await policyService.syncLegacyPayrollToPolicy(updates.payroll, orgId)
      .catch(e => console.error('Failed to sync payroll to policy engine:', e.message));
  }

  ApiResponse.success(res, { message: 'Settings successfully updated', data: updated.data });
}));

// POST /api/v1/settings/test-hikvision
router.post('/test-hikvision', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const { ipAddress, port, username, password, host, appKey, appSecret } = req.body;
  const targetHost = host || ipAddress;
  if (!targetHost) return ApiResponse.error(res, { message: 'Host/IP Address is required', statusCode: 400 });

  let hostname = targetHost;
  try { if (targetHost.startsWith('http')) hostname = new URL(targetHost).hostname; } catch (e) {}
  const targetPort = parseInt(port) || 8000;

  const checkConnection = () => new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(targetPort, hostname, () => { socket.destroy(); resolve(true); });
    socket.on('error', err => { socket.destroy(); reject(err); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timed out')); });
  });

  try {
    await checkConnection();
    ApiResponse.success(res, { message: `Successfully connected to ${hostname}:${targetPort}` });
  } catch (err) {
    ApiResponse.error(res, { message: `Failed to connect to ${hostname}:${targetPort}. Error: ${err.message}`, statusCode: 200 });
  }
}));

// POST /api/v1/settings/upload-branding
router.post('/upload-branding', checkPermission('Settings', 'General', 'edit'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, { message: 'No file uploaded', statusCode: 400 });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/branding/${req.file.filename}`;
  ApiResponse.success(res, { message: 'File uploaded successfully', data: { url: fileUrl } });
}));

// GET /api/v1/settings/report
router.get('/report', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(getOrgId(req));
  const report = settings.report || {};
  let recipients = [];
  if (report.recipientIds?.length) {
    recipients = await prisma.user.findMany({ where: { id: { in: report.recipientIds } }, select: { id: true, name: true, email: true } });
  }
  ApiResponse.success(res, { data: { ...report, recipients } });
}));

// POST /api/v1/settings/report
router.post('/report', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const current = await getOrCreateSettings(orgId);
  const merged = { ...current, report: { ...(current.report || {}), ...req.body } };
  await prisma.orgSettings.upsert({ where: { organizationId: orgId }, update: { data: merged }, create: { organizationId: orgId, data: merged } });
  ApiResponse.success(res, { message: 'Report settings saved', data: merged.report });
}));

// POST /api/v1/settings/report/send-now
router.post('/report/send-now', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(getOrgId(req));
  const { recipientIds: savedIds, reportType: savedType, projectIds: savedProjIds } = settings.report || {};
  const ids = req.body.recipientIds || savedIds || [];
  const type = req.body.reportType || savedType || 'approved';
  const projectIds = req.body.projectIds || savedProjIds || [];

  if (!ids.length) return ApiResponse.error(res, { message: 'No recipients configured.', statusCode: 400 });

  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true, name: true } });
  const emails = users.map(u => u.email).filter(Boolean);
  if (!emails.length) return ApiResponse.error(res, { message: 'No valid email addresses found.', statusCode: 400 });

  const companyName = settings.general?.companyName || 'CALTIMS';
  const format = settings.report?.defaultFormat || 'PDF';

  try {
    const result = await emailService.sendReportEmail(emails, type, companyName, projectIds, format);
    ApiResponse.success(res, { message: `Report sent to ${result.sent} recipient(s)`, data: result });
  } catch (err) {
    ApiResponse.error(res, { message: `Email failed: ${err.message}`, statusCode: 400 });
  }
}));

// POST /api/v1/settings/report/preview
router.post('/report/preview', checkPermission('Settings', 'General', 'view'), asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(getOrgId(req));
  try {
    const preview = await emailService.buildPreview(req.body.reportType || settings.report?.reportType || 'approved', settings.general?.companyName || 'CALTIMS', req.body.projectIds || settings.report?.projectIds || []);
    ApiResponse.success(res, { data: preview });
  } catch (err) {
    ApiResponse.error(res, { message: `Preview failed: ${err.message}`, statusCode: 500 });
  }
}));

// GET /api/v1/settings/timesheet
router.get('/timesheet', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(getOrgId(req));
  const config = settings.leavePolicy?.config || [];
  const leaveTypes = config.map(c => c.name);
  const eligibleLeaveTypes = config.filter(c => c.category === 'Paid' || c.category === 'Medical' || c.category === 'General').map(c => c.name);
  
  ApiResponse.success(res, { 
    data: { 
      ...(settings.timesheet || {}), 
      leaveTypes, 
      eligibleLeaveTypes 
    } 
  });
}));

// POST /api/v1/settings/timesheet
router.post('/timesheet', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const current = await getOrCreateSettings(orgId);
  const merged = { ...current, timesheet: { ...(current.timesheet || {}), ...req.body } };
  await prisma.orgSettings.upsert({ where: { organizationId: orgId }, update: { data: merged }, create: { organizationId: orgId, data: merged } });
  ApiResponse.success(res, { message: 'Timesheet settings saved', data: merged.timesheet });
}));

// GET /api/v1/settings/general
router.get('/general', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(getOrgId(req));
  ApiResponse.success(res, { data: settings.general || {} });
}));

// POST /api/v1/settings/general
router.post('/general', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const current = await getOrCreateSettings(orgId);
  const merged = { ...current, general: { ...(current.general || {}), ...req.body } };
  await prisma.orgSettings.upsert({ where: { organizationId: orgId }, update: { data: merged }, create: { organizationId: orgId, data: merged } });
  ApiResponse.success(res, { message: 'General settings saved', data: merged.general });
}));

// GET /api/v1/settings/payroll
router.get('/payroll', asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(getOrgId(req));
  ApiResponse.success(res, { data: settings.payroll || {} });
}));

// POST /api/v1/settings/payroll
router.post('/payroll', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const current = await getOrCreateSettings(orgId);
  const merged = { ...current, payroll: { ...(current.payroll || {}), ...req.body } };
  await prisma.orgSettings.upsert({ where: { organizationId: orgId }, update: { data: merged }, create: { organizationId: orgId, data: merged } });
  ApiResponse.success(res, { message: 'Payroll settings saved', data: merged.payroll });
}));

// POST /api/v1/settings/upload-payslip-template
router.post('/upload-payslip-template', checkPermission('Settings', 'General', 'edit'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, { message: 'No file uploaded', statusCode: 400 });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/branding/${req.file.filename}`;
  ApiResponse.success(res, { message: 'Payslip template uploaded successfully', data: { url: fileUrl, type: req.file.mimetype.includes('pdf') ? 'PDF' : 'HTML' } });
}));

// GET /api/v1/settings/employees
router.get('/employees', checkPermission('Employees', 'Employee List', 'view'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const q = req.query.q || '';
  const where = { organizationId: orgId, isActive: true };
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];
  const users = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true }, take: 100, orderBy: { name: 'asc' } });
  ApiResponse.success(res, { data: users });
}));

// GET /api/v1/settings/permission-audit-logs
router.get('/permission-audit-logs', checkPermission('Settings', 'Audit Logs', 'view'), asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { roleName, action, startDate, endDate, search } = req.query;
  const where = { organizationId: orgId };
  if (action) where.action = action;
  
  if (roleName) {
    where.details = {
      path: ['roleName'],
      equals: roleName
    };
  }

  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { details: { path: ['roleName'], string_contains: search } },
      { changedBy: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  const logs = await prisma.permissionAuditLog.findMany({ 
    where, 
    include: {
      changedBy: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' }, 
    take: 100 
  });

  const formattedLogs = logs.map(log => {
    const logData = log.details || {};
    return {
      ...log,
      timestamp: log.createdAt,
      changedByName: log.changedBy?.name || 'System',
      roleName: logData.roleName || 'N/A',
      // Flatten the nested details object for the frontend
      details: logData.details || logData
    };
  });

  ApiResponse.success(res, { data: formattedLogs });
}));

module.exports = router;

