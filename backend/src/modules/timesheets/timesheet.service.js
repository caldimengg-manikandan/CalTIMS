const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { ROLES } = require('../../constants');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { getWeekStart, getWeekEnd } = require('../../shared/utils/dateHelpers');
const policyService = require('../policyEngine/policy.service');
const { format } = require('date-fns');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const notificationService = require('../notifications/notification.service');
const { hasPermission } = require('../../shared/utils/rbac');

async function getWeekStartDay(organizationId) {
  const policy = await policyService.getPolicy(organizationId).catch(() => null);
  return policy?.attendance?.weekStartDay || 'monday';
}

/**
 * Validates if the operation is allowed based on compliance policy.
 */
async function validateCompliance(organizationId, weekStartDate, isAdminOperation = false) {
  if (isAdminOperation) return; // Admins can bypass compliance

  const policy = await policyService.getPolicy(organizationId).catch(() => null);
  const compliance = policy?.compliance || {};
  
  const now = new Date();
  const weekStart = new Date(weekStartDate);
  
  // 1. Freeze Day Check
  const freezeDay = compliance.timesheetFreezeDay || 28;
  const currentDay = now.getDate();
  
  // Check if we are trying to edit a previous month
  const isPastMonth = (now.getFullYear() > weekStart.getFullYear()) || 
                     (now.getFullYear() === weekStart.getFullYear() && now.getMonth() > weekStart.getMonth());
                     
  if (isPastMonth && currentDay >= freezeDay) {
    throw new AppError(`This period is frozen. Policy prohibits modifications after the ${freezeDay}${getOrdinalSign(freezeDay)} of the following month.`, 403);
  }

  // 2. Backdated Entries Check
  if (compliance.allowBackdatedEntries === false) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Find the start of the current week
    const wsd = policy?.attendance?.weekStartDay || 'monday';
    const currentWeekStart = getWeekStart(now, wsd);
    
    if (weekStart < currentWeekStart) {
      throw new AppError('Backdated timesheet entries are forbidden by organizational policy.', 403);
    }
  }
}

function getOrdinalSign(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Validates daily hours against organization guardrails.
 */
async function validateDailyGuardrails(organizationId, weekStart, rows) {
  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const tsSettings = settings?.data?.timesheet || {};
  
  if (!tsSettings.enforceMinHoursOnSubmit) return;

  const enforcementDate = tsSettings.enforceMinHoursEnabledAt ? new Date(tsSettings.enforceMinHoursEnabledAt) : null;
  if (enforcementDate) {
    const wsd = tsSettings.weekStartDay || 'monday';
    const weekEnd = getWeekEnd(weekStart, wsd);
    // If week ends before enforcement was enabled, skip validation
    if (weekEnd < enforcementDate) return;
  }

  const minHrs = tsSettings.minHoursPerDay || 0;
  const maxHrs = tsSettings.maxHoursPerDay || 24;
  if (minHrs === 0 && maxHrs === 24) return;

  // Process rows to get daily totals
  const totalsByDate = {};
  
  rows.forEach(row => {
    // Skip permission rows or system rows
    if (row.category === '__PERMISSION__' || (row.projectId === 'LEAVE-SYS') || row.isLeaveRow) return;
    
    if (Array.isArray(row.entries)) {
      row.entries.forEach(entry => {
        const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
        const hours = parseFloat(entry.hoursWorked || 0);
        totalsByDate[dateStr] = (totalsByDate[dateStr] || 0) + hours;
      });
    }
  });

  // Check each day in the totals
  for (const [dateStr, totalHours] of Object.entries(totalsByDate)) {
    if (totalHours === 0) continue; // Don't block empty days

    if (minHrs > 0 && totalHours < minHrs) {
      throw new AppError(`${dateStr}: logged ${totalHours}h but minimum is ${minHrs}h. Please add more hours before submitting.`, 400);
    }
    if (maxHrs > 0 && totalHours > maxHrs) {
      throw new AppError(`${dateStr}: logged ${totalHours}h exceeds the maximum of ${maxHrs}h.`, 400);
    }
  }
}

const timesheetService = {
  async getAll(query, context) {
    const { organizationId, userId, role } = context;
    const { page, limit, skip } = parsePagination(query);
    
    // Base scoping using helper
    const baseQuery = enforceOrg({}, organizationId);
    const where = baseQuery.where;

    const canManageTimesheets = hasPermission(context.permissions, 'Timesheets', 'Management', 'view');

    if (query.userId) {
       where.userId = query.userId;
    } else if (!canManageTimesheets && !context.isSuperAdmin && !context.isOwner) {
       // Only default to current user if they cannot manage all timesheets
       where.userId = userId;
    }

    if (query.status && !['All Status', 'All', 'All+Status'].includes(query.status)) {
      where.status = query.status.toUpperCase();
    }

    // Search Support
    if (query.search) {
      where.user = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { employee: { employeeCode: { contains: query.search, mode: 'insensitive' } } }
        ]
      };
    }

    // Date / Year / Month Filtering
    if (query.year && query.year !== 'All Years') {
       const year = parseInt(query.year);
       where.weekStartDate = {
         gte: new Date(`${year}-01-01T00:00:00.000Z`),
         lte: new Date(`${year}-12-31T23:59:59.999Z`)
       };
    }

    if (query.month && query.month !== 'All Months') {
       const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
       const monthIdx = monthNames.indexOf(query.month);
       if (monthIdx !== -1) {
          const year = query.year && query.year !== 'All Years' ? parseInt(query.year) : new Date().getFullYear();
          const startOfMonth = new Date(year, monthIdx, 1);
          const endOfMonth = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
          
          // Use OR or overlap logic? Usually we want weeks that START in that month
          where.weekStartDate = {
            gte: startOfMonth,
            lte: endOfMonth
          };
       }
    }

    if (query.from) {
        const fromDate = query.from.includes('T') ? new Date(query.from) : new Date(`${query.from}T00:00:00.000Z`);
        if (query.to && query.from === query.to) {
            // Specific day/week lookup (common for modal)
            where.weekStartDate = fromDate;
        } else {
            where.weekStartDate = { ...where.weekStartDate, gte: fromDate };
        }
    }
    if (query.to && query.from !== query.to) {
        const toDate = query.to.includes('T') ? new Date(query.to) : new Date(`${query.to}T23:59:59.999Z`);
        where.weekEndDate = { lte: toDate };
    }



    const [total, timesheets] = await Promise.all([
      prisma.timesheetWeek.count({ where }),
      prisma.timesheetWeek.findMany({
        where, 
        include: { 
            user: { 
                select: { 
                    id: true,
                    name: true, 
                    email: true,
                    employee: { select: { employeeCode: true, department: { select: { name: true } } } }
                } 
            } 
        },
        orderBy: [
          { status: 'desc' },
          { weekStartDate: 'desc' }
        ],
        skip, take: limit
      })
    ]);

    // Populate project details for all rows
    const allProjectIds = new Set();
    timesheets.forEach(ts => {
      if (Array.isArray(ts.rows)) {
        ts.rows.forEach(r => {
          const pid = r.projectId?._id || r.projectId;
          if (pid) allProjectIds.add(pid);
        });
      }
    });

    const projectsMap = new Map();
    if (allProjectIds.size > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: Array.from(allProjectIds) }, organizationId },
        select: { id: true, name: true, code: true }
      });
      projects.forEach(p => projectsMap.set(p.id, p));
    }

    const transformed = timesheets.map(ts => {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      let weekTotalHours = 0;

      const transformedRows = rows.map(row => {
        const pid = row.projectId?._id || row.projectId;
        const projectInfo = projectsMap.get(pid);
        
        // Calculate row total
        let rowTotalHours = 0;
        if (Array.isArray(row.entries)) {
            row.entries.forEach(e => {
                const h = parseFloat(e.hoursWorked || e.hours || 0);
                rowTotalHours += h;
            });
        }
        weekTotalHours += rowTotalHours;

        return {
          ...row,
          projectId: projectInfo ? { _id: projectInfo.id, id: projectInfo.id, name: projectInfo.name, code: projectInfo.code } : row.projectId,
          projectName: projectInfo?.name || row.projectName || (typeof row.projectId === 'string' ? row.projectId : row.projectId?._id),
          projectCode: projectInfo?.code || row.projectCode || '',
          totalHours: rowTotalHours
        };
      }); // Removed __PERMISSION__ filter to allow persistence

      return {
        ...ts,
        _id: ts.id,
        userId: ts.user ? { 
            ...ts.user, 
            _id: ts.user.id, 
            employeeId: ts.user.employee?.employeeCode,
            department: ts.user.employee?.department?.name 
        } : null,
        totalHours: weekTotalHours,
        rows: transformedRows
      };
    });

    return { data: transformed, pagination: buildPaginationMeta(total, page, limit), holidays: [] };
  },


  async create(data, context) {
    const { organizationId, userId } = context;
    const wsd = await getWeekStartDay(organizationId);
    const weekStart = getWeekStart(data.weekStartDate || new Date(), wsd);
    const weekEnd = getWeekEnd(weekStart, wsd);

    await validateCompliance(organizationId, weekStart);

    // Hard check for existence of same week to prevent duplicates (not in schema yet, but good practice)
    const existing = await prisma.timesheetWeek.findFirst({
      where: { userId, organizationId, weekStartDate: weekStart, isDeleted: false }
    });
    if (existing) throw new AppError('Timesheet for this week already exists', 409);

    return await prisma.timesheetWeek.create({
      data: {
        userId,
        organizationId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: 'DRAFT',
        rows: data.rows || []
      }
    });
  },

  async getById(id, organizationId) {
    const ts = await prisma.timesheetWeek.findUnique({
        where: { id_organizationId: { id, organizationId } },
        include: { 
            user: { 
                select: { 
                    id: true, 
                    name: true, 
                    email: true,
                    employee: { 
                        select: { employeeCode: true } 
                    }
                } 
            } 
        }
    });

    if (!ts || ts.isDeleted) throw new AppError('Timesheet not found', 404);

    // 1. Collect unique project IDs
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    const pids = new Set();
    rows.forEach(r => {
        const pid = r.projectId?._id || r.projectId;
        if (pid) pids.add(pid);
    });

    // 2. Fetch project details
    const projectsMap = new Map();
    if (pids.size > 0) {
        const projects = await prisma.project.findMany({
            where: { id: { in: Array.from(pids) }, organizationId },
            select: { id: true, name: true, code: true }
        });
        projects.forEach(p => projectsMap.set(p.id, p));
    }

    // 3. Transform rows
    let weekTotalHours = 0;
    const transformedRows = rows.map(row => {
        const pid = row.projectId?._id || row.projectId;
        const projectInfo = projectsMap.get(pid);
        
        let rowTotalHours = 0;
        if (Array.isArray(row.entries)) {
            row.entries.forEach(e => {
                rowTotalHours += parseFloat(e.hoursWorked || e.hours || 0);
            });
        }
        weekTotalHours += rowTotalHours;

        return {
            ...row,
            projectId: projectInfo ? { _id: projectInfo.id, id: projectInfo.id, name: projectInfo.name, code: projectInfo.code } : row.projectId,
            projectName: projectInfo?.name || row.projectName || (typeof row.projectId === 'string' ? row.projectId : row.projectId?._id),
            projectCode: projectInfo?.code || row.projectCode || '',
            totalHours: rowTotalHours
        };
    }); // Removed __PERMISSION__ filter to allow persistence

    return {
        ...ts,
        _id: ts.id,
        user: ts.user ? { 
            ...ts.user, 
            _id: ts.user.id,
            employeeId: ts.user.employee?.employeeCode
        } : null,
        totalHours: weekTotalHours,
        rows: transformedRows
    };
  },

  async update(id, data, organizationId) {
    const ts = await this.getById(id, organizationId);
    if (ts.status === 'APPROVED') throw new AppError('Cannot update an approved timesheet.', 400);

    await validateCompliance(organizationId, ts.weekStartDate);

    return await prisma.timesheetWeek.update({
        where: { id_organizationId: { id, organizationId } },
        data: { rows: data.rows, status: data.status || 'DRAFT' }
    });
  },

  async submit(id, organizationId) {
    const ts = await this.getById(id, organizationId);
    
    const updated = await prisma.timesheetWeek.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: 'SUBMITTED', submittedAt: new Date() }
    });

    // Notify admins
    const notifyWhere = { 
        organizationId, 
        isActive: true,
        isDeleted: false
    };

    const reporter = await prisma.user.findUnique({ where: { id: ts.userId }, select: { name: true } });
    const message = `${reporter?.name || 'An employee'} submitted a timesheet for week starting ${format(new Date(ts.weekStartDate), 'MMM dd, yyyy')}.`;

    // Fetch all users with Timesheets > Management > edit or view permission to notify
    const allUsers = await prisma.user.findMany({
        where: notifyWhere,
        include: { roleRef: true }
    });

    const adminsToNotify = allUsers.filter(u => {
        if (u.role === ROLES.SUPER_ADMIN || u.isOwner) return true;
        return hasPermission(u.roleRef?.permissions, 'Timesheets', 'Management', 'view');
    });

    for (const admin of adminsToNotify) {
        await notificationService.create({
            userId: admin.id,
            organizationId,
            title: 'Timesheet Submitted',
            message,
            type: 'TIMESHEET_SUBMITTED',
            refId: id,
            refModel: 'Timesheet'
        }).catch(err => console.error('Failed to send notification:', err));
    }

    return updated;
  },

  async approve(id, approverId, organizationId) {
    const ts = await this.getById(id, organizationId);
    const updated = await prisma.timesheetWeek.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date() }
    });

    // Notify user
    await notificationService.create({
        userId: ts.userId,
        organizationId,
        title: 'Timesheet Approved',
        message: `Your timesheet for week starting ${format(new Date(ts.weekStartDate), 'MMM dd, yyyy')} has been approved.`,
        type: 'TIMESHEET_APPROVED',
        refId: id,
        refModel: 'Timesheet'
    }).catch(err => console.error('Failed to send notification:', err));

    return updated;
  },

  async reject(id, approverId, reason, organizationId) {
    const ts = await this.getById(id, organizationId);
    const updated = await prisma.timesheetWeek.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: 'REJECTED', rejectionReason: reason, approvedBy: approverId }
    });

    // Notify user
    await notificationService.create({
        userId: ts.userId,
        organizationId,
        title: 'Timesheet Rejected',
        message: `Your timesheet for week starting ${format(new Date(ts.weekStartDate), 'MMM dd, yyyy')} was rejected. Reason: ${reason || 'No reason provided'}`,
        type: 'TIMESHEET_REJECTED',
        refId: id,
        refModel: 'Timesheet'
    }).catch(err => console.error('Failed to send notification:', err));

    return updated;
  },

  async delete(id, organizationId) {
    const ts = await this.getById(id, organizationId);
    
    await validateCompliance(organizationId, ts.weekStartDate);

    await prisma.timesheetWeek.update({ 
        where: { id_organizationId: { id, organizationId } },
        data: { isDeleted: true, deletedAt: new Date() }
    });
    return true;
  },

  async getDashboardSummary(query, context) {
    const { userId, organizationId, permissions, employeeId } = context;
    const canManageAll = hasPermission(permissions, 'Timesheets', 'Management', 'view');
    const isManager = !!employeeId; // Legacy check, can be refined
    const { weekStartDate, projectId } = query;

    const wsdSetting = await getWeekStartDay(organizationId);
    const weekStart = weekStartDate ? new Date(weekStartDate) : getWeekStart(new Date(), wsdSetting);
    const weekEnd = getWeekEnd(weekStart, wsdSetting);

    // BUG 1: Pre-identify leave project to skip it in all metrics
    const leaveProject = await prisma.project.findFirst({
      where: { code: 'LEAVE-SYS', organizationId, isDeleted: false },
      select: { id: true }
    });
    const leaveProjectId = leaveProject?.id;

    // 1. Global counts for organization (regardless of week)
    const [approvedTotal, submittedTotal, rejectedTotal, totalEmployees] = await Promise.all([
      prisma.timesheetWeek.count({ where: { organizationId, status: 'APPROVED', isDeleted: false } }),
      prisma.timesheetWeek.count({ where: { organizationId, status: 'SUBMITTED', isDeleted: false } }),
      prisma.timesheetWeek.count({ where: { organizationId, status: 'REJECTED', isDeleted: false } }),
      prisma.user.count({ where: { organizationId, isDeleted: false } }),
    ]);

    // 2. Fetch timesheets for the specific week for the productivity chart
    const tsWhere = { organizationId, weekStartDate: weekStart, isDeleted: false };
    
    if (!canManageAll && !context.isSuperAdmin && !context.isOwner) {
      if (isManager) {
        // Managers see their team's hours
        tsWhere.OR = [
          { userId: userId },
          { user: { employee: { managerId: employeeId } } }
        ];
      } else {
        // Employees see only their own
        tsWhere.userId = userId;
      }
    }

    const weeklyTimesheets = await prisma.timesheetWeek.findMany({
      where: tsWhere,
      select: { rows: true, userId: true, status: true }
    });

    // 3. Calculate metrics for the week
    let hoursThisWeek = 0;
    const dailyHoursMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const projectWeeklyHoursMap = {};
    const submittedUserIds = new Set();

    weeklyTimesheets.forEach(ts => {
      if (['SUBMITTED', 'APPROVED', 'FROZEN', 'ADMIN_FILLED'].includes(ts.status)) {
        submittedUserIds.add(ts.userId);
      }

      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      rows.forEach(row => {
        let pid = row.projectId?._id || row.projectId?.id || row.projectId;
        if (typeof pid === 'object') pid = pid._id || pid.id;

        // Skip non-project entries
        if (pid === leaveProjectId) return;
        if (projectId && projectId !== 'all' && pid !== projectId) return;

        if (Array.isArray(row.entries)) {
          row.entries.forEach(entry => {
            const h = parseFloat(entry.hoursWorked || entry.hours || 0);
            if (isNaN(h) || h <= 0) return;
            
            hoursThisWeek += h;

            const date = new Date(entry.date);
            const dayName = format(date, 'eee');
            if (dailyHoursMap[dayName] !== undefined) {
              dailyHoursMap[dayName] += h;
            }

            if (pid) {
              projectWeeklyHoursMap[pid] = (projectWeeklyHoursMap[pid] || 0) + h;
            }
          });
        }
      });
    });

    // 4. Calculate CUMULATIVE hours per project for budget display
    // We need to look across all weeks for these projects
    const cumulativeWhere = { organizationId, isDeleted: false };
    if (isManager) {
      cumulativeWhere.OR = [
        { userId: userId },
        { user: { employee: { managerId: employeeId } } }
      ];
    } else if (!canManageAll && !context.isSuperAdmin && !context.isOwner) {
      cumulativeWhere.userId = userId;
    }

    const allTimesheets = await prisma.timesheetWeek.findMany({
      where: cumulativeWhere,
      select: { rows: true }
    });

    const projectCumulativeHoursMap = {};
    allTimesheets.forEach(ts => {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      rows.forEach(row => {
        let pid = row.projectId?._id || row.projectId?.id || row.projectId;
        if (typeof pid === 'object') pid = pid._id || pid.id;
        if (!pid) return;

        if (pid === leaveProjectId) return; // Skip leave in cumulative too

        if (Array.isArray(row.entries)) {
          row.entries.forEach(entry => {
            const h = parseFloat(entry.hoursWorked || entry.hours || 0);
            if (!isNaN(h) && h > 0) {
              projectCumulativeHoursMap[pid] = (projectCumulativeHoursMap[pid] || 0) + h;
            }
          });
        }
      });
    });

    // 5. Finalize the project totals list with names
    const projectIds = Object.keys(projectWeeklyHoursMap);
    const projectsInDb = await prisma.project.findMany({
      where: { 
        id: { in: projectIds },
        isDeleted: false
      },
      select: { id: true, name: true, code: true }
    });

    const projectTotals = projectsInDb.map(p => {
      const pid = p.id;
      return {
        projectId: pid,
        projectName: p.name,
        projectCode: p.code,
        totalHours: projectWeeklyHoursMap[pid] || 0,
        cumulativeHours: projectCumulativeHoursMap[pid] || 0
      };
    }).filter(pt => pt.totalHours > 0 || pt.cumulativeHours > 0);

    const notSubmittedCount = Math.max(0, totalEmployees - submittedUserIds.size);
    const dailyHours = Object.entries(dailyHoursMap).map(([day, hours]) => ({ day, hours }));

    return {
      approvedTimesheets: approvedTotal,
      pendingTimesheets: submittedTotal,
      rejectedTimesheets: rejectedTotal,
      notSubmittedCount: notSubmittedCount,
      totalEmployees,
      hoursThisWeek,
      dailyHours,
      projectTotals,
      submissionDeadline: 'Friday 18:00',
    };
  },

  async bulkUpsert(data, context) {
    const { organizationId, userId } = context;
    if (!organizationId || !userId) throw new AppError('Context missing', 401);
    
    const wsd = await getWeekStartDay(organizationId);
    const results = [];

    // Grouping rows by weekStartDate to handle multiple weeks if sent, 
    // although typically frontend sends one week at a time.
    const weeksMap = {}; // Key: ISO WeekStart Date string
    for (const item of data) {
      const ws = getWeekStart(item.weekStartDate || new Date(), wsd).toISOString();
      if (!weeksMap[ws]) weeksMap[ws] = [];
      weeksMap[ws].push({
        projectId: item.projectId?._id || item.projectId,
        category: item.category,
        entries: item.entries
      });
    }

    for (const [wsStr, rows] of Object.entries(weeksMap)) {
      const weekStart = new Date(wsStr);
      const weekEnd = getWeekEnd(weekStart, wsd);

      const existing = await prisma.timesheetWeek.findFirst({
        where: { userId, organizationId, weekStartDate: weekStart, isDeleted: false }
      });

      // Compliance check
      try {
        await validateCompliance(organizationId, weekStart);
      } catch (err) {
        // For bulk, we might want to collect errors or skip, but throwing for now
        throw err;
      }

      let ts;
      if (existing) {
        // Prevent editing if already submitted or approved
        if (['SUBMITTED', 'APPROVED', 'FROZEN'].includes(existing.status)) {
          throw new AppError(`Cannot save values to a timesheet that is already ${existing.status.toLowerCase()}.`, 400);
        }
        ts = await prisma.timesheetWeek.update({
          where: { id: existing.id },
          data: { rows, updatedAt: new Date() }
        });
      } else {
        ts = await prisma.timesheetWeek.create({
          data: {
            userId,
            organizationId,
            weekStartDate: weekStart,
            weekEndDate: weekEnd,
            status: 'DRAFT',
            rows
          }
        });
      }
      results.push(ts);
      // Sync to granular table
      await this.syncToGranularTimesheet(ts.id);
    }
    return results;
  },


  async bulkSubmit(data, context) {
    const { organizationId } = context;
    // 1. Save drafts first
    const upserted = await this.bulkUpsert(data, context);
    
    const results = [];
    for (const ts of upserted) {
      // 2. Hard Enforcement Validation
      await validateDailyGuardrails(organizationId, ts.weekStartDate, ts.rows);

      const submitted = await prisma.timesheetWeek.update({
        where: { id: ts.id },
        data: { 
          status: 'SUBMITTED', 
          submittedAt: new Date() 
        }
      });
      results.push(submitted);
      // Sync to granular table for submission
      await this.syncToGranularTimesheet(submitted.id);

      // Notify admins
        const allUsers = await prisma.user.findMany({
            where: { 
                isActive: true, 
                organizationId,
                isDeleted: false
            },
            include: { roleRef: true }
        });

        const adminsToNotify = allUsers.filter(u => {
            if (u.role === 'super_admin' || u.isOwner) return true;
            // Notify those who can manage timesheets
            return hasPermission(u.roleRef?.permissions, 'Timesheets', 'Management', 'approve') || 
                   hasPermission(u.roleRef?.permissions, 'Timesheets', 'Management', 'edit');
        });

        const adminIds = adminsToNotify.map(a => a.id);
        const reporter = await prisma.user.findUnique({ where: { id: context.userId }, select: { name: true } });
        const message = `${reporter?.name || 'An employee'} submitted a timesheet for week starting ${format(new Date(submitted.weekStartDate), 'MMM dd, yyyy')}.`;

        for (const adminId of adminIds) {
          await notificationService.create({
              userId: adminId,
              organizationId,
              title: 'Timesheet Submitted',
              message,
              type: 'TIMESHEET_SUBMITTED',
              refId: submitted.id,
              refModel: 'Timesheet'
          }).catch(err => console.error('Failed to send notification:', err));
      }
    }
    return results;
  },


  async getHistory(query, context) {
    const result = await this.getAll(query, context);
    
    // 1. Collect all unique project IDs from all timesheets to fetch them in one query
    const allProjectIds = new Set();
    result.data.forEach(ts => {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      rows.forEach(r => {
        const pid = r.projectId?._id || r.projectId;
        if (pid) allProjectIds.add(pid);
      });
    });

    // 2. Fetch project details (names and codes)
    const projectsMap = new Map();
    if (allProjectIds.size > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: Array.from(allProjectIds) }, organizationId: context.organizationId },
        select: { id: true, name: true, code: true }
      });
      projects.forEach(p => projectsMap.set(p.id, p));
    }

    // 3. Transform raw TimesheetWeek records into the summary format
    const transformed = result.data.map(ts => {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      const projectNames = new Set();
      const projectCodes = new Set();
      let totalHours = 0;

      rows.forEach(row => {
        const pid = row.projectId?._id || row.projectId;
        const projectInfo = projectsMap.get(pid);
        
        projectNames.add(projectInfo?.name || row.projectName || pid);
        projectCodes.add(projectInfo?.code || row.projectCode || '');
        
        if (Array.isArray(row.entries)) {
          row.entries.forEach(entry => {
            totalHours += parseFloat(entry.hoursWorked || entry.hours || 0);
          });
        }
      });

      return {
        _id: ts.id,
        id: ts.id,
        weekStartDate: ts.weekStartDate,
        weekEndDate: ts.weekEndDate,
        status: ts.status,
        statuses: [ts.status.toLowerCase()],
        totalHours,
        projects: Array.from(projectNames),
        projectCodes: Array.from(projectCodes),
        lastUpdated: ts.updatedAt,
        userId: ts.userId, // Use the already transformed userId from getAll
        rows: ts.rows
      };
    });

    return {
      data: transformed,
      pagination: result.pagination
    };
  },



  async getAdminSummary(organizationId) {
    const [total, pending, approved, rejected, users, allSheets] = await Promise.all([
        prisma.timesheetWeek.count({ where: { organizationId, status: { not: 'DRAFT' }, isDeleted: false } }),
        prisma.timesheetWeek.count({ where: { organizationId, status: 'SUBMITTED', isDeleted: false } }),
        prisma.timesheetWeek.count({ where: { organizationId, status: 'APPROVED', isDeleted: false } }),
        prisma.timesheetWeek.count({ where: { organizationId, status: 'REJECTED', isDeleted: false } }),
        prisma.timesheetWeek.groupBy({
          by: ['userId'],
          where: { organizationId, isDeleted: false }
        }),
        prisma.timesheetWeek.findMany({
          where: { organizationId, status: { not: 'DRAFT' }, isDeleted: false },
          select: { rows: true }
        })
    ]);

    let totalHours = 0;
    allSheets.forEach(ts => {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      rows.forEach(row => {
        if (Array.isArray(row.entries)) {
          row.entries.forEach(e => {
            const h = parseFloat(e.hoursWorked || e.hours || 0);
            if (!isNaN(h)) totalHours += h;
          });
        }
      });
    });

    return { 
      totalTimesheets: total, 
      pendingReview: pending,
      approved,
      rejected,
      submittedUsersCount: users.length,
      totalHours
    };
  },

  async getAdminTimesheets(query, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const where = { organizationId, isDeleted: false };

    if (query.status && query.status !== 'All' && query.status !== 'All Status') {
        where.status = query.status.toUpperCase();
    } else {
        // By default, don't show drafts in "Manage" view
        where.status = { not: 'DRAFT' };
    }

    if (query.userId) where.userId = query.userId;
    
    // Search Implementation
    if (query.search) {
      where.user = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { employee: { employeeCode: { contains: query.search, mode: 'insensitive' } } }
        ]
      };
    }

    // Week Filter
    if (query.week) {
       where.weekStartDate = new Date(query.week);
    }

    // Year Filter
    if (query.year) {
       const year = parseInt(query.year);
       if (!isNaN(year)) {
         where.weekStartDate = {
           gte: new Date(`${year}-01-01`),
           lte: new Date(`${year}-12-31`)
         };
       }
    }

    if (query.projectId) {
       // Filtering by projectId inside JSON rows usually requires JS level or raw SQL
       // For now fetching with base where and filtering by project in JS if projectId provided
    }

    const [total, timesheets] = await Promise.all([
      prisma.timesheetWeek.count({ where }),
      prisma.timesheetWeek.findMany({
        where,
        include: { 
          user: { 
            select: { 
              id: true, 
              name: true, 
              email: true, 
              employee: { 
                select: { 
                  id: true,
                  employeeCode: true, 
                  department: { select: { name: true } } 
                } 
              } 
            } 
          } 
        },
        orderBy: { weekStartDate: 'desc' },
        skip,
        take: limit
      })
    ]);

    // Manual filtering for projectId if specified
    let rawList = timesheets;
    if (query.projectId) {
      rawList = timesheets.filter(ts => {
        const rows = Array.isArray(ts.rows) ? ts.rows : [];
        return rows.some(r => (r.projectId?._id || r.projectId) === query.projectId);
      });
    }

    // 1. Collect all unique project IDs to fetch names/codes
    const allProjectIds = new Set();
    rawList.forEach(ts => {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      rows.forEach(r => {
        const pid = r.projectId?._id || r.projectId;
        if (pid) allProjectIds.add(pid);
      });
    });

    // 2. Fetch project details
    const projectsMap = new Map();
    if (allProjectIds.size > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: Array.from(allProjectIds) }, organizationId },
        select: { id: true, name: true, code: true }
      });
      projects.forEach(p => projectsMap.set(p.id, p));
    }

    // 4. Fetch approver names
    const allApproverIds = new Set();
    rawList.forEach(ts => { if (ts.approvedBy) allApproverIds.add(ts.approvedBy); });
    const approversMap = new Map();
    if (allApproverIds.size > 0) {
        const users = await prisma.user.findMany({
            where: { id: { in: Array.from(allApproverIds) } },
            select: { id: true, name: true }
        });
        users.forEach(u => approversMap.set(u.id, u));
    }

    // 5. Transform for frontend
    const transformed = rawList.map(ts => {
        const rows = Array.isArray(ts.rows) ? ts.rows : [];
        let totalHours = 0;
        
        const transformedRows = rows.map(row => {
            const pid = row.projectId?._id || row.projectId;
            const projectInfo = projectsMap.get(pid);
            
            const pTotalHours = Array.isArray(row.entries) 
                ? row.entries.reduce((sum, e) => sum + parseFloat(e.hoursWorked || e.hours || 0), 0)
                : 0;
            
            totalHours += pTotalHours;

            return {
                ...row,
                projectId: projectInfo ? { _id: projectInfo.id, id: projectInfo.id, name: projectInfo.name, code: projectInfo.code } : row.projectId,
                projectName: projectInfo?.name || row.projectName || (typeof row.projectId === 'string' ? row.projectId : row.projectId?._id),
                projectCode: projectInfo?.code || row.projectCode || '',
                totalHours: pTotalHours
            };
        });

        return {
            ...ts,
            _id: ts.id,
            userId: ts.user ? { 
                ...ts.user, 
                _id: ts.user.id, 
                employeeId: ts.user.employee?.employeeCode,
                department: ts.user.employee?.department?.name
            } : null,
            approvedBy: ts.approvedBy ? (approversMap.get(ts.approvedBy) || { name: 'Unknown' }) : null,
            totalHours,
            rows: transformedRows
        };
    });

    return { data: transformed, pagination: buildPaginationMeta(total, page, limit) };
  },


  async getAdminFilterOptions(organizationId) {
    const [users, projects, departments, weeksData] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId, isDeleted: false },
        select: { id: true, name: true, employee: { select: { employeeCode: true } } }
      }),
      prisma.project.findMany({
        where: { organizationId, isDeleted: false },
        select: { id: true, name: true, code: true }
      }),
      prisma.department.findMany({
        where: { organizationId },
        select: { id: true, name: true }
      }),
      prisma.timesheetWeek.findMany({
        where: { organizationId, isDeleted: false },
        select: { weekStartDate: true },
        distinct: ['weekStartDate'],
        orderBy: { weekStartDate: 'desc' },
        take: 52 // Last year of weeks
      })
    ]);

    const years = [...new Set(weeksData.map(w => new Date(w.weekStartDate).getFullYear()))].sort((a,b) => b-a);

    return {
      users: users.map(u => ({ id: u.id, name: u.name, employeeCode: u.employee?.employeeCode })),
      projects: projects.map(p => ({ id: p.id, name: p.name, code: p.code })),
      departments: departments.map(d => ({ id: d.id, name: d.name })),
      weeks: weeksData.map(w => w.weekStartDate),
      years: years,
      statuses: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']
    };
  },

  async adminFill(rows, targetUserId, adminId, organizationId) {
    // Basic implementation for adminFill
    const wsd = await getWeekStartDay(organizationId);
    if (!rows || !Array.isArray(rows)) throw new AppError('Invalid rows provided', 400);

    const weekStart = getWeekStart(rows[0]?.entries[0]?.date || new Date(), wsd);
    const weekEnd = getWeekEnd(weekStart, wsd);

    return await prisma.timesheetWeek.upsert({
      where: { userId_organizationId_weekStartDate: { userId: targetUserId, organizationId, weekStartDate: weekStart } },
      update: { rows, status: 'ADMIN_FILLED', updatedAt: new Date() },
      create: {
        userId: targetUserId,
        organizationId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: 'ADMIN_FILLED',
        rows
      }
    });
  },

  async getAdminKpiSummary(kpi, organizationId) {
    // Dummy implementation for now to satisfy the controller
    return { value: 0, label: kpi };
  },

  async getCompliance(query, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const { weekStartDate, search } = query;
    
    // Normalize weekStartDate based on organization's policy
    const wsdSetting = await getWeekStartDay(organizationId);
    const wsd = getWeekStart(weekStartDate || new Date(), wsdSetting);

    const userWhere = {
      organizationId,
      isDeleted: false,
    };

    if (search) {
      userWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employee: { employeeCode: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.user.findMany({
        where: userWhere,
        include: {
          employee: {
            include: { department: true }
          },
          timesheetWeeks: {
            where: {
              weekStartDate: wsd,
              isDeleted: false
            }
          }
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      })
    ]);

    const data = users.map(u => {
      const ts = u.timesheetWeeks?.[0];
      
      let totalHours = 0;
      if (ts && Array.isArray(ts.rows)) {
        ts.rows.forEach(row => {
          if (Array.isArray(row.entries)) {
            row.entries.forEach(e => {
              totalHours += parseFloat(e.hoursWorked || e.hours || 0);
            });
          }
        });
      }

      return {
        user: {
          _id: u.id,
          id: u.id,
          name: u.name,
          email: u.email,
          employeeId: u.employee?.employeeCode,
          department: u.employee?.department?.name
        },
        status: ts ? ts.status.toLowerCase() : 'missing',
        totalHours,
        weekStartDate: wsd,
        timesheetId: ts?.id
      };
    });

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  /**
   * Synchronizes data from the summary table (TimesheetWeek) to the granular table (Timesheet).
   */
  async syncToGranularTimesheet(timesheetWeekId) {
    try {
      const tsWeek = await prisma.timesheetWeek.findUnique({ where: { id: timesheetWeekId } });
      if (!tsWeek) return;

      const employee = await prisma.employee.findUnique({
        where: { userId_organizationId: { userId: tsWeek.userId, organizationId: tsWeek.organizationId } }
      });
      if (!employee) {
        console.error(`Sync failed: Employee not found for userId ${tsWeek.userId} in org ${tsWeek.organizationId}`);
        return;
      }

      // 1. Remove existing granular entries for this employee and week to prevent duplicates
      await prisma.timesheet.deleteMany({
        where: {
          employeeId: employee.id,
          organizationId: tsWeek.organizationId,
          workDate: {
            gte: tsWeek.weekStartDate,
            lte: tsWeek.weekEndDate
          },
          isDeleted: false
        }
      });

      // 2. Prepare daily granular entries from JSON rows
      const granularEntries = [];
      const rows = Array.isArray(tsWeek.rows) ? tsWeek.rows : [];

      for (const row of rows) {
        if (!row.entries || !Array.isArray(row.entries)) continue;
        
        for (const entry of row.entries) {
          const hours = parseFloat(entry.hoursWorked || entry.hours || 0);
          const pid = row.projectId?._id || row.projectId;
          
          if (hours > 0 && pid !== '__PERMISSION__' && pid !== 'LEAVE-SYS') {
            granularEntries.push({
              employeeId: employee.id,
              projectId: pid, // Handle both object and string formats
              organizationId: tsWeek.organizationId,
              workDate: new Date(entry.date),
              hours: hours,
              description: row.category || row.task || '',
              status: tsWeek.status
            });
          }
        }
      }

      // 3. Bulk insert granular entries
      if (granularEntries.length > 0) {
        await prisma.timesheet.createMany({
          data: granularEntries
        });
      }
    } catch (err) {
      console.error(`Error in syncToGranularTimesheet: ${err.message}`);
    }
  }
};

module.exports = timesheetService;

