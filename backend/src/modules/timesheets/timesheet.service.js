'use strict';

const mongoose = require('mongoose');
const Timesheet = require('./timesheet.model');
const Project = require('../projects/project.model');
const User = require('../users/user.model');
const CalendarEvent = require('../calendar/calendar.model');
const AppError = require('../../shared/utils/AppError');
const { TIMESHEET_STATUS, ROLES, CALENDAR_EVENT_TYPES } = require('../../constants');
const { parsePagination, buildPaginationMeta, buildSort } = require('../../shared/utils/pagination');
const { getWeekStart, getWeekEnd, formatDuration } = require('../../shared/utils/dateHelpers');
const notificationService = require('../notifications/notification.service');
const emailService = require('../../shared/services/email.service');
const notifier = require('../../shared/services/notifier');
const Settings = require('../settings/settings.model');
const { logAction } = require('../audit/audit.routes');
const policyService = require('../policyEngine/policy.service');
const PERMISSION_MARKER = '__PERMISSION__';

function calculateWeeklyHours(rows) {
  const PAID_LEAVE_TYPES = ['annual', 'sick', 'casual'];
  let totalHours = 0;

  for (const row of rows) {
    for (const entry of row.entries || []) {
      if (entry.isLeave) {
        const lt = (entry.leaveType || '').toLowerCase();
        if (lt === 'lop') {
          // LOP: Loss of Pay — contributes 0 hours
          totalHours += 0;
        } else if (PAID_LEAVE_TYPES.includes(lt)) {
          // Paid leave: respect stored hoursWorked (8 full day / 4 half-day)
          // Fall back to 8 if somehow 0 was stored
          totalHours += (entry.hoursWorked > 0 ? entry.hoursWorked : 8);
        } else {
          // Legacy entry without leaveType — trust hoursWorked
          totalHours += (entry.hoursWorked || 0);
        }
      } else {
        // Normal work entry
        totalHours += (entry.hoursWorked || 0);
      }
    }
  }

  return {
    totalHours,
    isIncomplete: totalHours < 40,
  };
}

/**
 * Internal helper to fetch weekStartDay from settings
 */
async function getWeekStartDay(organizationId) {
  const policy = await policyService.getPolicy(organizationId);
  return policy?.attendance?.weekStartDay || 'monday';
}

/**
 * Internal helper to check if a week should be frozen
 */
async function getFreezeInfo(weekStartDate, organizationId) {
  const policy = await policyService.getPolicy(organizationId);
  const freezeDay = policy?.compliance?.timesheetFreezeDay || 28;
  
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const ws = new Date(weekStartDate);
  const wsMonth = ws.getMonth();
  const wsYear = ws.getFullYear();

  // A week is frozen if it belongs to a month prior to the current month 
  // AND the current day of the month is >= freezeDay.
  const isPreviousMonth = (wsYear < currentYear) || (wsYear === currentYear && wsMonth < currentMonth);
  const isFrozen = isPreviousMonth && (currentDay >= freezeDay);

  return { isFrozen, freezeDay, currentDay };
}

const timesheetService = {
  // ─── Core CRUD ──────────────────────────────────────────────────────────────
  async create(data, userId, organizationId) {
    const wsd = await getWeekStartDay(organizationId);
    const weekStart = getWeekStart(data.weekStartDate, wsd);
    const weekEnd = getWeekEnd(weekStart, wsd);

    // Ensure no existing timesheet for this week
    const existing = await Timesheet.findOne({ userId, weekStartDate: weekStart, organizationId });
    if (existing) throw new AppError('Timesheet already exists for this week', 400);

    const ts = await Timesheet.create({
      userId,
      organizationId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: TIMESHEET_STATUS.DRAFT,
      rows: []
    });

    logAction({
        userId,
        action: 'CREATE_TIMESHEET',
        entityType: 'Timesheet',
        entityId: ts._id,
        details: { weekStartDate: weekStart }
    });

    return ts;
  },

  async update(id, data, userId, organizationId) {
    const ts = await Timesheet.findOne({ _id: id, organizationId });
    if (!ts) throw new AppError('Timesheet not found', 404);
    if (ts.userId.toString() !== userId.toString()) throw new AppError('Unauthorized', 403);
    
    const { isFrozen } = await getFreezeInfo(ts.weekStartDate, organizationId);
    if (ts.status === TIMESHEET_STATUS.FROZEN || isFrozen) {
      if (ts.status !== TIMESHEET_STATUS.FROZEN) {
        ts.status = TIMESHEET_STATUS.FROZEN;
        ts.frozenAt = new Date();
        await ts.save();
      }
      throw new AppError('Timesheet is frozen and cannot be edited. Please raise a Help & Support ticket.', 400);
    }
    if (![TIMESHEET_STATUS.DRAFT, TIMESHEET_STATUS.REJECTED].includes(ts.status)) {
      throw new AppError('Cannot edit submitted/approved timesheets', 400);
    }

    // In the new model, we mostly use bulkUpsert, but if individual update is used:
    if (data.rows) ts.rows = data.rows;
    if (data.comments) ts.comments = data.comments;

    await this.validateLimits(ts);
    await ts.save();

    logAction({
        userId,
        action: 'UPDATE_TIMESHEET',
        entityType: 'Timesheet',
        entityId: id,
        details: { weekStartDate: ts.weekStartDate }
    });

    return ts;
  },

  async getById(id, requestor, organizationId) {
    const timesheet = await Timesheet.findOne({ _id: id, organizationId })
      .populate('userId', 'name email employeeId department')
      .populate('rows.projectId', 'name code')
      .populate('approvedBy', 'name email');

    if (!timesheet) throw new AppError('Timesheet not found', 404);

    if (requestor.role === ROLES.EMPLOYEE && timesheet.userId._id.toString() !== requestor._id.toString()) {
      throw new AppError('You do not have permission to view this timesheet', 403);
    }

    return timesheet;
  },

  async getAll(query, requestor, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const sort = buildSort(query, { weekStartDate: -1 });
    const filter = { organizationId };

    // Allow admins/managers to specify a userId, otherwise default to self
    if ((requestor.role === ROLES.ADMIN || requestor.role === ROLES.MANAGER) && query.userId) {
      filter.userId = query.userId;
    } else {
      filter.userId = requestor._id;
    }

    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      const wsd = await getWeekStartDay(organizationId);
      filter.weekStartDate = {};
      // Use getWeekStart to normalize inputs to UTC midnight if possible, 
      // or at least use Date.UTC to avoid server TZ issues.
      if (query.from) filter.weekStartDate.$gte = getWeekStart(new Date(query.from), wsd);
      if (query.to) filter.weekStartDate.$lte = getWeekStart(new Date(query.to), wsd);
    }

    const [timesheets, total] = await Promise.all([
      Timesheet.find(filter)
        .populate('userId', 'name email employeeId department')
        .populate('rows.projectId', 'name code')
        .populate('approvedBy', 'name email')
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean(),
      Timesheet.countDocuments(filter),
    ]);

    // Fetch holidays if a specific week is targeted
    let holidays = [];
    if (query.weekStartDate) {
      const wsd = await getWeekStartDay(organizationId);
      const ws = getWeekStart(new Date(query.weekStartDate), wsd);
      const we = getWeekEnd(ws, wsd);

      holidays = await CalendarEvent.find({
        organizationId,
        eventType: CALENDAR_EVENT_TYPES.HOLIDAY,
        isGlobal: true,
        $or: [
          { startDate: { $lte: we, $gte: ws } },
          { endDate: { $lte: we, $gte: ws } },
          { startDate: { $lte: ws }, endDate: { $gte: we } }
        ]
      }).select('title startDate endDate').lean();
    }

    return {
      timesheets,
      pagination: buildPaginationMeta(total, page, limit),
      holidays: holidays.map(h => ({
        date: h.startDate,
        title: h.title
      }))
    };
  },

  // ─── Bulk Operations (Merging into One Document per Week) ─────────────────

  async bulkUpsert(dataArray, userId, organizationId) {
    if (!dataArray.length) return [];

    // 1. Group input by week (redundant since usually one week is sent, but safe)
    const wsd = await getWeekStartDay(organizationId);
    const weeksMap = new Map();
    for (const data of dataArray) {
      const ws = getWeekStart(data.weekStartDate, wsd).toISOString();
      if (!weeksMap.has(ws)) weeksMap.set(ws, []);
      weeksMap.get(ws).push(data);
    }

    const results = [];
    for (const [wsIso, rowsData] of weeksMap.entries()) {
      const weekStart = new Date(wsIso);
      const weekEnd = getWeekEnd(weekStart, wsd);

      let timesheet = await Timesheet.findOne({ userId, weekStartDate: weekStart, organizationId });

      const { isFrozen } = await getFreezeInfo(weekStart);

      if (!timesheet) {
        timesheet = new Timesheet({
          userId,
          organizationId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          status: isFrozen ? TIMESHEET_STATUS.FROZEN : TIMESHEET_STATUS.DRAFT,
          rows: [],
          frozenAt: isFrozen ? new Date() : null
        });
      }

      if (timesheet.status === TIMESHEET_STATUS.FROZEN || isFrozen) {
        if (timesheet.status !== TIMESHEET_STATUS.FROZEN) {
          timesheet.status = TIMESHEET_STATUS.FROZEN;
          timesheet.frozenAt = new Date();
          await timesheet.save();
        }
        throw new AppError(`Cannot update a frozen timesheet for week ${weekStart.toDateString()}. Please raise a Help & Support ticket.`, 400);
      }
      if (![TIMESHEET_STATUS.DRAFT, TIMESHEET_STATUS.REJECTED].includes(timesheet.status)) {
        throw new AppError(`Cannot update a ${timesheet.status} timesheet for week ${weekStart.toDateString()}`, 400);
      }

      // Sync rows: Replace only work rows, leave system rows (leaves/holidays) intact
      // 1. Filter out existing work rows (rows that have a projectId that matches our inputs)
      const inputPids = new Set(rowsData.map(r => r.projectId.toString()));
      const systemRows = timesheet.rows.filter(r => {
        const pid = (r.projectId?._id || r.projectId || '').toString();
        // A row is "system" if it's LEAVE-SYS or if it's NOT in our current input set
        // But to be safe, we only preserve LEAVE-SYS rows or rows marked as leave
        return pid === 'LEAVE-SYS' || r.category === 'Leave' || r.category === 'Holiday' ||
          ['annual', 'sick', 'casual', 'lop'].includes(r.category?.toLowerCase());
      });

      const newWorkRows = rowsData.map(row => ({
        projectId: row.projectId,
        category: row.category || 'Development',
        entries: row.entries
      }));

      timesheet.rows = [...systemRows, ...newWorkRows];

      await this.validateLimits(timesheet);
      await timesheet.save();

      logAction({
          userId,
          action: 'UPDATE_TIMESHEET',
          entityType: 'Timesheet',
          entityId: timesheet._id,
          details: { weekStartDate: timesheet.weekStartDate, bulk: true }
      });

      results.push(timesheet);
    }
    return results;
  },

  async adminFill(dataArray, targetUserId, adminId, organizationId) {
    if (!dataArray.length) return [];

    const wsd = await getWeekStartDay(organizationId);
    const weeksMap = new Map();
    for (const data of dataArray) {
      const ws = getWeekStart(data.weekStartDate, wsd).toISOString();
      if (!weeksMap.has(ws)) weeksMap.set(ws, []);
      weeksMap.get(ws).push(data);
    }

    const results = [];
    for (const [wsIso, rowsData] of weeksMap.entries()) {
      const weekStart = new Date(wsIso);
      const weekEnd = getWeekEnd(weekStart, wsd);

      let timesheet = await Timesheet.findOne({ userId: targetUserId, weekStartDate: weekStart, organizationId });

      if (!timesheet) {
        timesheet = new Timesheet({
          userId: targetUserId,
          organizationId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          rows: []
        });
      }

      const inputPids = new Set(rowsData.map(r => r.projectId.toString()));
      const systemRows = timesheet.rows.filter(r => {
        const pid = (r.projectId?._id || r.projectId || '').toString();
        return pid === 'LEAVE-SYS' || r.category === 'Leave' || r.category === 'Holiday' ||
          ['annual', 'sick', 'casual', 'lop'].includes(r.category?.toLowerCase());
      });

      const newWorkRows = rowsData.map(row => ({
        projectId: row.projectId,
        category: row.category || 'Development',
        entries: row.entries
      }));

      timesheet.rows = [...systemRows, ...newWorkRows];

      timesheet.status = TIMESHEET_STATUS.ADMIN_FILLED;
      timesheet.filledByAdmin = true;
      timesheet.adminFilledBy = adminId;
      timesheet.adminFilledAt = new Date();

      await this.validateLimits(timesheet);
      await timesheet.save();

      const targetUser = await User.findOne({ _id: targetUserId, organizationId }).select('name');

      logAction({
          userId: adminId,
          action: 'ADMIN_FILLED_TIMESHEET',
          entityType: 'Timesheet',
          entityId: timesheet._id,
          details: { 
              weekStartDate: timesheet.weekStartDate, 
              ownerId: targetUserId,
              ownerName: targetUser?.name || 'Unknown'
          }
      });

      results.push(timesheet);
    }
    return results;
  },

  async validateLimits(timesheet) {
    const policy = await policyService.getPolicy(timesheet.organizationId);
    const limits = policy?.attendance || {}; // Map some limits if needed, or keep from settings if not in policy
    const compliance = policy?.compliance || {};
    const settingsDoc = await Settings.findOne({ organizationId: timesheet.organizationId }).lean(); // Fallback for specific limits not yet in policy

    // ── Compliance Check: Backdated Entries ──────────────────────────────────
    // Restriction: Cannot fill timesheets for weeks prior to the current week
    if (compliance.allowBackdatedEntries === false) {
      const wsd = settingsDoc?.general?.weekStartDay || 'monday';
      const currentWeekStart = getWeekStart(new Date(), wsd);
      
      if (new Date(timesheet.weekStartDate) < currentWeekStart) {
        // Only enforce for non-admin fills (if filledByAdmin is false)
        if (!timesheet.filledByAdmin) {
          throw new AppError('Timesheet entry restricted. Backdated entries are only allowed if enabled in system compliance settings.', 400);
        }
      }
    }

    const entriesByDay = {}; 
    let totalEntries = 0;
    const permissionDays = new Set();
    const permissionHoursByDay = {};

    timesheet.rows.forEach(row => {
      const isPermission = row.category?.toLowerCase() === 'permission' || row.category === PERMISSION_MARKER;
      row.entries.forEach(e => {
        if (e.hoursWorked > 0) {
          try {
            const d = new Date(e.date);
            const dateStr = d.toISOString().split('T')[0];
            
            // Standard entry limits
            entriesByDay[dateStr] = (entriesByDay[dateStr] || 0) + 1;
            totalEntries++;

            // Permission limits
            if (isPermission) {
              permissionDays.add(dateStr);
              permissionHoursByDay[dateStr] = (permissionHoursByDay[dateStr] || 0) + e.hoursWorked;
            }
          } catch (err) {
            // Skip invalid dates
          }
        }
      });
    });

    // ── Standard Entry Limits ───────────────────────────────────────────────
    if (limits.maxEntriesPerDay > 0) {
      for (const date in entriesByDay) {
        if (entriesByDay[date] > limits.maxEntriesPerDay) {
          throw new AppError(`Daily entry limit exceeded for ${date}. Maximum allowed: ${limits.maxEntriesPerDay} entries. You have ${entriesByDay[date]}.`, 400);
        }
      }
    }

    if (limits.maxEntriesPerWeek > 0) {
      if (totalEntries > limits.maxEntriesPerWeek) {
        throw new AppError(`Weekly entry limit exceeded. Maximum allowed: ${limits.maxEntriesPerWeek} entries. You have ${totalEntries}.`, 400);
      }
    }

    // ── Permission Limits ───────────────────────────────────────────────────
    const { permissionMaxHoursPerDay = 4, permissionMaxDaysPerWeek = 0, permissionMaxDaysPerMonth = 0 } = limits;

    // Daily Permission Hours Limit
    if (permissionMaxHoursPerDay > 0) {
      for (const date in permissionHoursByDay) {
        if (permissionHoursByDay[date] > permissionMaxHoursPerDay) {
          throw new AppError(`Daily permission hour limit exceeded for ${date}. Maximum allowed: ${permissionMaxHoursPerDay} hours. You entered ${permissionHoursByDay[date]} hours.`, 400);
        }
      }
    }

    // Weekly Permission Days Limit
    if (permissionMaxDaysPerWeek > 0) {
      if (permissionDays.size > permissionMaxDaysPerWeek) {
        throw new AppError(`Weekly permission day limit exceeded. Maximum allowed: ${permissionMaxDaysPerWeek} days. You have permission entries for ${permissionDays.size} days.`, 400);
      }
    }

    // Monthly Permission Days Limit
    if (permissionMaxDaysPerMonth > 0 && permissionDays.size > 0) {
      const monthStart = new Date(timesheet.weekStartDate);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
      monthEnd.setUTCDate(0);
      monthEnd.setUTCHours(23, 59, 59, 999);

      // Query other timesheets for the same user in the same month
      const otherTimesheets = await Timesheet.find({
        userId: timesheet.userId,
        weekStartDate: { $gte: monthStart, $lte: monthEnd },
        _id: { $ne: timesheet._id }
      }).lean();

      const monthPermissionDays = new Set([...permissionDays]);
      
      otherTimesheets.forEach(ts => {
        ts.rows.forEach(row => {
          if (row.category?.toLowerCase() === 'permission' || row.category === PERMISSION_MARKER) {
            row.entries.forEach(e => {
              if (e.hoursWorked > 0) {
                try {
                  const d = new Date(e.date);
                  const dateStr = d.toISOString().split('T')[0];
                  // Only count days within this month
                  if (d >= monthStart && d <= monthEnd) {
                    monthPermissionDays.add(dateStr);
                  }
                } catch (err) {}
              }
            });
          }
        });
      });

      if (monthPermissionDays.size > permissionMaxDaysPerMonth) {
        throw new AppError(`Monthly permission day limit exceeded. Maximum allowed: ${permissionMaxDaysPerMonth} days. You already have ${monthPermissionDays.size} days in this month.`, 400);
      }
    }
  },

  async bulkSubmit(dataArray, userId, organizationId) {
    // Reuses bulkUpsert to save, then sets status to SUBMITTED
    const savedTimesheets = await this.bulkUpsert(dataArray, userId, organizationId);

    // ── Daily Hours Guardrail Enforcement on Submit ────────────────────────────
    const settingsDoc = await Settings.findOne({ organizationId }).lean();
    const tsPolicy = settingsDoc?.timesheet || {};
    const { minHoursPerDay = 0, maxHoursPerDay = 24, enforceMinHoursOnSubmit = false } = tsPolicy;
    const isWeekendWorkable = settingsDoc?.general?.isWeekendWorkable || false;

    if (enforceMinHoursOnSubmit && minHoursPerDay > 0) {
      for (const ts of savedTimesheets) {
        // Aggregate hours per calendar day across all rows
        const hoursPerDay = {};
        ts.rows.forEach(row => {
          // Skip permission rows from min-hours check
          if (row.category?.toLowerCase() === 'permission' || row.category === PERMISSION_MARKER) return;
          row.entries.forEach(e => {
            try {
              const d = new Date(e.date);
              const dayOfWeek = d.getUTCDay(); // 0=Sun, 6=Sat
              if (!isWeekendWorkable && (dayOfWeek === 0 || dayOfWeek === 6)) return;
              const dateStr = d.toISOString().split('T')[0];
              hoursPerDay[dateStr] = (hoursPerDay[dateStr] || 0) + (e.hoursWorked || 0);
            } catch (err) {}
          });
        });

        for (const [date, hours] of Object.entries(hoursPerDay)) {
          // Only validate days where hours were actually entered
          if (hours > 0 && hours < minHoursPerDay) {
            throw new AppError(
              `On ${date}, total logged hours ${formatDuration(hours)} are below the required minimum of ${minHoursPerDay}h per day.`,
              400
            );
          }
          if (hours > maxHoursPerDay) {
            throw new AppError(
              `On ${date}, total logged hours ${formatDuration(hours)} exceed the maximum of ${maxHoursPerDay}h per day.`,
              400
            );
          }
        }
      }
    }

    const user = await User.findOne({ _id: userId, organizationId }).select('name employeeId managerId');
    const systemApprovers = await User.find({ role: ROLES.ADMIN, isActive: true, organizationId }).select('_id email');
    const directManager = user.managerId ? await User.findOne({ _id: user.managerId, organizationId }).select('_id email') : null;

    for (const ts of savedTimesheets) {
      ts.status = TIMESHEET_STATUS.SUBMITTED;
      ts.submittedAt = new Date();
      await ts.save();

      // Gather Project Managers for this specific week
      const projectIds = [...new Set(ts.rows.map(r => r.projectId?.toString()))].filter(Boolean);
      const projectManagers = await Project.find({ _id: { $in: projectIds }, organizationId }).select('managerId').populate('managerId', '_id email');
      
      const approverMap = new Map();
      // Add system admins
      systemApprovers.forEach(a => approverMap.set(a._id.toString(), a));
      // Add direct manager
      if (directManager) approverMap.set(directManager._id.toString(), directManager);
      // Add project managers
      projectManagers.forEach(p => {
        if (p.managerId && p.managerId._id) {
          approverMap.set(p.managerId._id.toString(), p.managerId);
        }
      });

      const uniqueApprovers = Array.from(approverMap.values());
      const weekStr = ts.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const year = ts.weekStartDate.getFullYear();

      const notificationPromises = uniqueApprovers.map(approver =>
        notifier.send(approver._id, {
          userEmail: approver.email,
          type: 'timesheet_submitted',
          title: 'Timesheet Submitted',
          message: `${user.name} (${user.employeeId}) has submitted a timesheet for the week of ${weekStr} (${year}).`,
          refId: ts._id,
          refModel: 'Timesheet',
        })
      );
      await Promise.all(notificationPromises);
    }

    return savedTimesheets;
  },

  async submit(id, requestor, organizationId) {
    const ts = await Timesheet.findOne({ _id: id, organizationId });
    if (!ts) throw new AppError('Timesheet not found', 404);

    // Allow owner or Admin/Manager to submit
    const isOwner = ts.userId.toString() === (requestor._id || requestor).toString();
    const isAdminOrManager = requestor.role === ROLES.ADMIN || requestor.role === ROLES.MANAGER;

    if (!isOwner && !isAdminOrManager) {
      throw new AppError('You do not have permission to submit this timesheet', 403);
    }

    ts.status = TIMESHEET_STATUS.SUBMITTED;
    ts.submittedAt = new Date();
    await ts.save();

    // Notify Admins, Direct Manager, and Project Managers
    const user = await User.findOne({ _id: ts.userId, organizationId }).select('name employeeId managerId');
    const systemApprovers = await User.find({ role: ROLES.ADMIN, isActive: true, organizationId }).select('_id email');
    const directManager = user.managerId ? await User.findOne({ _id: user.managerId, organizationId }).select('_id email') : null;
    
    const projectIds = [...new Set(ts.rows.map(r => r.projectId?.toString()))].filter(Boolean);
    const projectManagers = await Project.find({ _id: { $in: projectIds }, organizationId }).select('managerId').populate('managerId', '_id email');
    
    const approverMap = new Map();
    systemApprovers.forEach(a => approverMap.set(a._id.toString(), a));
    if (directManager) approverMap.set(directManager._id.toString(), directManager);
    projectManagers.forEach(p => {
      if (p.managerId && p.managerId._id) {
        approverMap.set(p.managerId._id.toString(), p.managerId);
      }
    });

    const uniqueApprovers = Array.from(approverMap.values());
    const weekStr = ts.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = ts.weekStartDate.getFullYear();

    const notificationPromises = uniqueApprovers.map(approver =>
      notifier.send(approver._id, {
        userEmail: approver.email,
        type: 'timesheet_submitted',
        title: 'Timesheet Submitted',
        message: `${user.name} (${user.employeeId}) has submitted a timesheet for the week of ${weekStr} (${year}).`,
        refId: ts._id,
        refModel: 'Timesheet',
      })
    );
    await Promise.all(notificationPromises);

    return ts;
  },

  // ─── Workflow ──────────────────────────────────────────────────────────────

  async approve(id, approverId, organizationId) {
    const timesheet = await Timesheet.findOne({ _id: id, organizationId }).populate('userId', 'name');
    if (!timesheet) throw new AppError('Timesheet not found', 404);
    if (timesheet.status !== TIMESHEET_STATUS.SUBMITTED) {
      throw new AppError('Only submitted timesheets can be approved', 400);
    }

    timesheet.status = TIMESHEET_STATUS.APPROVED;
    timesheet.approvedBy = approverId;
    timesheet.approvedAt = new Date();
    await timesheet.save();

    logAction({
        userId: approverId,
        action: 'APPROVE_TIMESHEET',
        entityType: 'Timesheet',
        entityId: id,
        details: { 
            weekStartDate: timesheet.weekStartDate, 
            ownerId: timesheet.userId?._id || timesheet.userId,
            ownerName: timesheet.userId?.name || 'Unknown'
        }
    });

    // Check budget for each project in the timesheet
    const projectIds = [...new Set(timesheet.rows.map(r => r.projectId?.toString()))].filter(Boolean);
    for (const pid of projectIds) {
      this.checkProjectBudget(pid); // Fire and forget or await? Let's not block approval
    }

    // Notify employee
    const approver = await User.findById(approverId).select('name');
    const employee = await User.findById(timesheet.userId).select('email');
    const weekStr = timesheet.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = timesheet.weekStartDate.getFullYear();

    await notifier.send(timesheet.userId, {
      userEmail: employee?.email,
      type: 'timesheet_approved',
      title: '✅ Timesheet Approved',
      message: `Your timesheet for the week of ${weekStr} (${year}) has been approved by ${approver?.name || 'Admin'}.`,
      refId: timesheet._id,
      refModel: 'Timesheet',
    });

    return timesheet;
  },

  async reject(id, approverId, reason, organizationId) {
    if (!reason) throw new AppError('Rejection reason is required', 400);
    const timesheet = await Timesheet.findOne({ _id: id, organizationId }).populate('userId', 'name');
    if (!timesheet) throw new AppError('Timesheet not found', 404);

    timesheet.status = TIMESHEET_STATUS.REJECTED;
    timesheet.rejectionReason = reason;
    await timesheet.save();

    logAction({
        userId: approverId,
        action: 'REJECT_TIMESHEET',
        entityType: 'Timesheet',
        entityId: id,
        details: { 
            weekStartDate: timesheet.weekStartDate, 
            ownerId: timesheet.userId?._id || timesheet.userId,
            ownerName: timesheet.userId?.name || 'Unknown',
            reason 
        }
    });

    const approver = await User.findById(approverId).select('name');
    const employee = await User.findById(timesheet.userId).select('email');
    const weekStr = timesheet.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = timesheet.weekStartDate.getFullYear();

    await notifier.send(timesheet.userId, {
      userEmail: employee?.email,
      type: 'timesheet_rejected',
      title: '❌ Timesheet Rejected',
      message: `Your timesheet for the week of ${weekStr} (${year}) was rejected by ${approver?.name || 'Admin'}: "${reason}".`,
      refId: timesheet._id,
      refModel: 'Timesheet',
    });

    return timesheet;
  },

  async delete(id, requestor, organizationId) {
    const timesheet = await Timesheet.findOne({ _id: id, organizationId }).populate('userId', 'name');
    if (!timesheet) throw new AppError('Timesheet not found', 404);
    if (requestor.role !== ROLES.ADMIN && timesheet.userId?._id.toString() !== requestor._id.toString()) {
      throw new AppError('Unauthorized', 403);
    }
    await timesheet.deleteOne();

    logAction({
        userId: requestor._id || requestor,
        action: 'DELETE_TIMESHEET',
        entityType: 'Timesheet',
        entityId: id,
        details: { 
            weekStartDate: timesheet.weekStartDate, 
            ownerId: timesheet.userId?._id || timesheet.userId,
            ownerName: timesheet.userId?.name || 'Unknown' 
        }
    });

    return true;
  },

  // ─── Reporting ─────────────────────────────────────────────────────────────

  async getCompliance(query, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const { weekStartDate, search } = query;
    if (!weekStartDate) throw new AppError('Week start date is required', 400);

    const userFilter = { role: ROLES.EMPLOYEE, isActive: true, organizationId };
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const policy = await policyService.getPolicy(organizationId);
    const wsd = policy?.attendance?.weekStartDay || 'monday';
    const weekStart = getWeekStart(new Date(weekStartDate), wsd);

    const [employees, total] = await Promise.all([
      User.find(userFilter)
        .select('name employeeId email department')
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(userFilter)
    ]);

    const timesheets = await Timesheet.find({ 
      weekStartDate: weekStart, 
      userId: { $in: employees.map(e => e._id) },
      organizationId 
    }).lean();
    
    const tsMap = new Map(timesheets.map(ts => [ts.userId.toString(), ts]));
    const { isFrozen } = await getFreezeInfo(weekStart, organizationId);

    const complianceData = employees.map(emp => {
      const ts = tsMap.get(emp._id.toString());
      let status = ts ? ts.status : 'missing';
      
      if (isFrozen && (status === 'missing' || status === TIMESHEET_STATUS.DRAFT)) {
        status = TIMESHEET_STATUS.FROZEN;
      }

      return {
        user: emp,
        status,
        timesheetId: ts ? ts._id : null,
        totalHours: ts ? ts.totalHours : 0,
        frozenAt: ts ? ts.frozenAt : (isFrozen ? new Date(weekStart) : null)
      };
    });

    return {
      data: complianceData,
      pagination: buildPaginationMeta(total, page, limit)
    };
  },

  async checkProjectBudget(projectId) {
    try {
      const project = await Project.findById(projectId).populate('managerId', 'name email');
      if (!project || !project.budgetHours || project.budgetHours <= 0) return;

      // Calculate total approved hours for this project across all timesheets
      const aggregate = await Timesheet.aggregate([
        { $match: { status: TIMESHEET_STATUS.APPROVED, 'rows.projectId': new mongoose.Types.ObjectId(projectId) } },
        { $unwind: '$rows' },
        { $match: { 'rows.projectId': new mongoose.Types.ObjectId(projectId) } },
        { $group: { _id: null, totalHours: { $sum: '$rows.totalHours' } } }
      ]);

      const totalHours = aggregate.length > 0 ? aggregate[0].totalHours : 0;

      if (totalHours > project.budgetHours) {
        const Settings = mongoose.model('Settings');
        const settings = await Settings.findOne({ organizationId }).lean();
        const notifSettings = settings?.notifications || {};
        const companyName = settings?.organization?.companyName || 'CALTIMS';

        // 1. In-App Notifications
        if (notifSettings.inAppEnabled !== false) {
          const admins = await User.find({ role: ROLES.ADMIN, isActive: true, organizationId }).select('_id email');
          
          const notificationPromises = admins.map(admin =>
            notificationService.create({
              userId: admin._id,
              type: 'project_budget_exceeded',
              title: '⚠️ Project Budget Exceeded',
              message: `Project ${project.name} has exceeded its budget of ${project.budgetHours} hours (Current: ${totalHours.toFixed(2)} hours).`,
              refId: project._id,
              refModel: 'Project',
            })
          );

          if (project.managerId) {
            notificationPromises.push(
              notificationService.create({
                userId: project.managerId._id,
                type: 'project_budget_exceeded',
                title: '⚠️ Project Budget Exceeded',
                message: `Your project ${project.name} has exceeded its budget of ${project.budgetHours} hours (Current: ${totalHours.toFixed(2)} hours).`,
                refId: project._id,
                refModel: 'Project',
              })
            );
          }
          await Promise.all(notificationPromises);
        }

        // 2. Email Notifications
        if (notifSettings.emailEnabled !== false) {
          const admins = await User.find({ role: ROLES.ADMIN, isActive: true, organizationId }).select('email');
          const recipientEmails = [...new Set([
            ...admins.map(a => a.email),
            project.managerId?.email
          ])].filter(Boolean);

          if (recipientEmails.length > 0) {
            await emailService.sendBudgetExceededEmail(recipientEmails, {
              name: project.name,
              code: project.code,
              budgetHours: project.budgetHours,
              totalHours: totalHours
            }, companyName);
          }
        }
      }
    } catch (err) {
      console.error('Error checking project budget:', err);
    }
  },

  async getHistory(query, requestor, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { organizationId: new mongoose.Types.ObjectId(organizationId) };

    // Strictly restrict to the current user for history view
    filter.userId = new mongoose.Types.ObjectId(requestor._id);

    if (query.status && query.status !== 'All Status') filter.status = query.status;

    if (query.search && query.search.trim().length >= 2) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { 'rows.category': searchRegex },
        { rejectionReason: searchRegex },
        { status: searchRegex }
      ];

      // Also search by project name/code if possible
      const projects = await Project.find({
        organizationId,
        $or: [{ name: searchRegex }, { code: searchRegex }]
      }).distinct('_id');

      if (projects.length > 0) {
        filter.$or.push({ 'rows.projectId': { $in: projects } });
      }
    }

    // Support year + optional month filtering
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (query.year && query.year !== 'All Years') {
      const year = parseInt(query.year);
      if (query.month && query.month !== 'All Months') {
        const monthIndex = MONTHS.indexOf(query.month);
        if (monthIndex !== -1) {
          // Filter to specific month: weekStartDate can fall in that month
          filter.weekStartDate = {
            $gte: new Date(Date.UTC(year, monthIndex, 1)),
            $lte: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
          };
        }
      } else {
        filter.weekStartDate = {
          $gte: new Date(Date.UTC(year, 0, 1)),
          $lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
        };
      }
    } else if (query.month && query.month !== 'All Months') {
      // Month filter without year: use current year
      const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = MONTHS.indexOf(query.month);
      if (monthIndex !== -1) {
        const now = new Date();
        const year = now.getUTCFullYear();
        filter.weekStartDate = {
          $gte: new Date(Date.UTC(year, monthIndex, 1)),
          $lte: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
        };
      }
    }

    const [timesheets, total] = await Promise.all([
      Timesheet.find(filter)
        .populate('userId', 'name employeeId')
        .populate('rows.projectId', 'name code')
        .sort({ weekStartDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Timesheet.countDocuments(filter),
    ]);

    // Format for frontend history table
    const formatted = timesheets.map(ts => ({
      _id: ts._id,
      id: ts._id,
      weekStartDate: ts.weekStartDate,
      weekEndDate: ts.weekEndDate,
      projects: ts.rows.map(r => r.projectId?.name || (r.projectId?.code === 'LEAVE-SYS' || r.category?.toLowerCase().includes('leave') ? 'Leave' : r.category || 'Unknown')),
      projectCodes: ts.rows.map(r => r.projectId?.code || 'N/A'),
      totalHours: ts.totalHours,
      statuses: [ts.status], // Array for compatibility with frontend logic
      lastUpdated: ts.updatedAt,
      userId: ts.userId,
      rows: ts.rows.map(r => ({
        projectId: r.projectId?._id,
        projectName: r.projectId?.name,
        projectCode: r.projectId?.code,
        category: r.category,
        totalHours: r.totalHours,
        entries: r.entries
      }))
    }));

    return {
      data: formatted,
      pagination: buildPaginationMeta(total, page, limit)
    };
  },

  async getDashboardSummary(userId, role, organizationId, query = {}) {
    const wsd = await getWeekStartDay(organizationId);
    const isAllWeeks = query.weekStartDate === 'all';
    const weekStart = isAllWeeks ? null : (query.weekStartDate ? getWeekStart(new Date(query.weekStartDate), wsd) : getWeekStart(new Date(), wsd));
    const projectId = query.projectId && query.projectId !== 'all' ? query.projectId : null;

    // -- 1. Fetch Personal Stats (for the progress chart/hero) --
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDayIdx = wsd.toLowerCase() === 'sunday' ? 0 : 1;

    let dailyHours = [];
    for (let i = 0; i < 7; i++) {
      dailyHours.push({ day: days[(startDayIdx + i) % 7], hours: 0 });
    }

    let hoursThisWeek = 0;
    let personalStatus = null;

    // Use a range to find potentially overlapping timesheets if a setting was changed
    const personalFilter = { userId, organizationId };
    if (projectId) personalFilter['rows.projectId'] = new mongoose.Types.ObjectId(projectId);
    
    if (!isAllWeeks) {
      const rangeStart = new Date(weekStart);
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
      const rangeEnd = new Date(weekStart);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
      personalFilter.weekStartDate = { $gte: rangeStart, $lte: rangeEnd };
    }

    const [allPersonalTs, personalPending, personalApproved, personalRejected] = await Promise.all([
      Timesheet.find(personalFilter).populate('rows.projectId', 'name code').lean(),
      Timesheet.countDocuments({ ...personalFilter, status: TIMESHEET_STATUS.SUBMITTED }),
      Timesheet.countDocuments({ ...personalFilter, status: TIMESHEET_STATUS.APPROVED }),
      Timesheet.countDocuments({ ...personalFilter, status: TIMESHEET_STATUS.REJECTED }),
    ]);

    const weekEnd = isAllWeeks ? null : getWeekEnd(weekStart, wsd);

    let projectTotalsMap = new Map();
    allPersonalTs.forEach(ts => {
      // For status, pick the "most advanced" one or the one that exactly matches the current week key
      if (!isAllWeeks && ts.weekStartDate.toISOString() === weekStart.toISOString()) {
        personalStatus = ts.status;
      } else if (!personalStatus) {
        personalStatus = ts.status;
      }

      if (ts.rows) {
        ts.rows.forEach(row => {
          const rowProjectId = row.projectId?._id?.toString() || row.projectId?.toString();
          if (projectId && rowProjectId !== projectId.toString()) return;

          // Skip leave rows — they should not count as productive hours
          const isLeaveRow = row.projectId?.code === 'LEAVE-SYS' || row.projectId?.name === 'Leave';
          if (isLeaveRow) return;

          let rowHoursInWeek = 0;

          if (row.entries) {
            row.entries.forEach(entry => {
              const dateObj = new Date(entry.date);
              // Only count if it falls within the current definition of the week
              if (!isAllWeeks && (dateObj < weekStart || dateObj > weekEnd)) return;

              const day = dateObj.getUTCDay(); // 0-6
              const idx = (day - startDayIdx + 7) % 7;
              if (idx >= 0 && idx < 7) {
                const hrs = (entry.hoursWorked || 0);
                dailyHours[idx].hours += hrs;
                hoursThisWeek += hrs;
                rowHoursInWeek += hrs;
              }
            });
          }

          if (rowProjectId && rowHoursInWeek > 0) {
            if (!projectTotalsMap.has(rowProjectId)) {
              projectTotalsMap.set(rowProjectId, {
                projectId: rowProjectId,
                projectName: row.projectId?.name || 'Unknown',
                projectCode: row.projectId?.code || 'N/A',
                totalHours: 0
              });
            }
            projectTotalsMap.get(rowProjectId).totalHours += rowHoursInWeek;
          }
        });
      }
    });

    const personalProjectTotals = Array.from(projectTotalsMap.values())
      .sort((a, b) => b.totalHours - a.totalHours);

    const baseStats = {
      hoursThisWeek,
      dailyHours,
      personalStatus,
      projectTotals: personalProjectTotals
    };

    // -- 2. Admin/Manager stats --
    if (role === ROLES.ADMIN || role === ROLES.MANAGER) {
      let activeUsers = [];
      if (projectId) {
        const Project = mongoose.model('Project');
        const projectDoc = await Project.findOne({ _id: projectId, organizationId })
          .populate('allocatedEmployees.userId', 'name employeeId department isActive role')
          .lean();
        if (projectDoc) {
          activeUsers = projectDoc.allocatedEmployees
            .map(a => a.userId)
            .filter(u => u && u.isActive !== false && [ROLES.EMPLOYEE, ROLES.MANAGER].includes(u.role));
        }
      } else {
        activeUsers = await User.find({ organizationId, isActive: true, role: { $in: [ROLES.EMPLOYEE, ROLES.MANAGER] } }).select('name employeeId department').lean();
      }

      const totalManagers = await User.countDocuments({ organizationId, isActive: true, role: ROLES.MANAGER });
      const totalAdmins = await User.countDocuments({ organizationId, isActive: true, role: ROLES.ADMIN });

      const timesheetFilter = { organizationId };
      if (!isAllWeeks) {
        const rangeStart = new Date(weekStart);
        rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
        const rangeEnd = new Date(weekStart);
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
        timesheetFilter.weekStartDate = { $gte: rangeStart, $lte: rangeEnd };
      }
      if (projectId) {
        timesheetFilter['rows.projectId'] = new mongoose.Types.ObjectId(projectId);
      }

      const allTimesheetsThisWeek = await Timesheet.find(timesheetFilter)
        .populate('userId', 'name employeeId department')
        .populate('rows.projectId', 'name code')
        .lean();

      const submittedThisWeek = allTimesheetsThisWeek.filter(ts => ts.status !== TIMESHEET_STATUS.DRAFT);
      const submittedUserIds = submittedThisWeek.map(ts => ts.userId?._id?.toString()).filter(Boolean);
      const notSubmitted = activeUsers.filter(u => !submittedUserIds.includes(u._id.toString()));

      let teamDailyHours = [];
      for (let i = 0; i < 7; i++) {
        teamDailyHours.push({ day: days[(startDayIdx + i) % 7], hours: 0 });
      }
      let totalTeamHoursThisWeek = 0;

      let projectTotalsMap = new Map();

      allTimesheetsThisWeek.forEach(ts => {
        if (ts.rows) {
          ts.rows.forEach(row => {
            const rowProjectId = row.projectId?._id?.toString() || row.projectId?.toString();
            // If projectId filter is active, only count rows for that project
            if (projectId && rowProjectId !== projectId.toString()) return;

            // Skip leave rows — they should not count as productive hours
            const isLeaveRow = row.projectId?.code === 'LEAVE-SYS' || row.projectId?.name === 'Leave';
            if (isLeaveRow) return;

            let rowHoursInWeek = 0;

            if (row.entries) {
              row.entries.forEach(entry => {
                const dateObj = new Date(entry.date);
                // Only count if it falls within the current definition of the week
                if (!isAllWeeks && (dateObj < weekStart || dateObj > weekEnd)) return;

                const day = dateObj.getUTCDay(); // 0-6
                const idx = (day - startDayIdx + 7) % 7;
                if (idx >= 0 && idx < 7) {
                  const hrs = (entry.hoursWorked || 0);
                  teamDailyHours[idx].hours += hrs;
                  totalTeamHoursThisWeek += hrs;
                  rowHoursInWeek += hrs;
                }
              });
            } else if (isAllWeeks) {
              rowHoursInWeek = row.totalHours || 0;
            }

            // Project totals — all non-leave rows with hours
            if (rowProjectId && rowHoursInWeek > 0) {
                if (!projectTotalsMap.has(rowProjectId)) {
                    projectTotalsMap.set(rowProjectId, {
                        projectId: rowProjectId,
                        projectName: row.projectId?.name || 'Unknown',
                        projectCode: row.projectId?.code || 'N/A',
                        totalHours: 0,
                        timesheetIds: new Set()
                    });
                }
                const pInfo = projectTotalsMap.get(rowProjectId);
                pInfo.totalHours += rowHoursInWeek;
                pInfo.timesheetIds.add(ts._id.toString());
            }
          });
        }
      });

      const projectTotalsTemp = Array.from(projectTotalsMap.values())
        .map(p => ({
            ...p,
            timesheetCount: p.timesheetIds.size
        }));

      // Find the most relevant timesheet per user for accurate status counts
      const userTimesheetMap = new Map();
      allTimesheetsThisWeek.forEach(ts => {
          const uId = ts.userId?._id?.toString();
          if (!uId) return;
          
          if (!userTimesheetMap.has(uId)) {
             userTimesheetMap.set(uId, ts);
          } else {
             const existing = userTimesheetMap.get(uId);
             const existingDiff = Math.abs(new Date(existing.weekStartDate) - weekStart);
             const currentDiff = Math.abs(new Date(ts.weekStartDate) - weekStart);
             if (currentDiff < existingDiff) {
                 userTimesheetMap.set(uId, ts);
             }
          }
      });

      const relevantTimesheets = Array.from(userTimesheetMap.values());

      // Actionable counts:
      // Pending should be GLOBAL so admins don't miss anything.
      // Approved/Rejected should be scoped to the selected WEEK/PROJECT for dashboard context.
      const baseFilter = {};
      if (projectId) baseFilter['rows.projectId'] = new mongoose.Types.ObjectId(projectId);

      const pendingTimesheets = await Timesheet.countDocuments({ ...baseFilter, status: TIMESHEET_STATUS.SUBMITTED });
      const approvedCount = relevantTimesheets.filter(ts => ts.status === TIMESHEET_STATUS.APPROVED).length;
      const rejectedCount = relevantTimesheets.filter(ts => ts.status === TIMESHEET_STATUS.REJECTED).length;

      const ProjectModel = mongoose.model('Project');
      const allActiveProjects = await ProjectModel.find({ status: 'active' }).select('name code budgetHours').lean();
      
      const mergedProjectTotals = allActiveProjects.reduce((acc, p) => {
        if (p.name === 'Leave' || p.code === 'LEAVE-SYS') return acc;
        const existing = projectTotalsTemp.find(pt => pt.projectCode === p.code || pt.projectName === p.name);
        if (existing) {
          acc.push({ 
            ...existing, 
            projectId: existing.projectId || p._id.toString(),
            budgetHours: p.budgetHours || 0 
          });
        } else {
          acc.push({
            projectId: p._id.toString(),
            projectName: p.name,
            projectCode: p.code,
            totalHours: 0,
            timesheetCount: 0,
            budgetHours: p.budgetHours || 0
          });
        }
        return acc;
      }, []);
      mergedProjectTotals.sort((a, b) => b.totalHours - a.totalHours);

      return {
        // Override baseStats with team data for Admin
        hoursThisWeek: totalTeamHoursThisWeek,
        dailyHours: teamDailyHours,
        personalStatus: personalStatus,
        
        submittedCount: submittedThisWeek.length,
        notSubmittedCount: notSubmitted.length,
        submittedEmployees: submittedThisWeek.map(ts => ({
          id: ts.userId?._id,
          name: ts.userId?.name,
          employeeId: ts.userId?.employeeId,
          department: ts.userId?.department,
          totalHours: ts.totalHours,
          status: ts.status,
          projects: ts.rows.map(r => r.projectId?.name).filter(Boolean).join(', ')
        })),
        notSubmittedEmployees: notSubmitted.slice(0, 10),
        totalEmployees: activeUsers.length,
        totalManagers,
        totalAdmins,
        projectTotals: mergedProjectTotals,
        totalTimesheets: allTimesheetsThisWeek.length,
        pendingTimesheets,
        approvedTimesheets: approvedCount,
        rejectedTimesheets: rejectedCount,
      };
    }

      const settingsDoc = await mongoose.model('Settings').findOne({ organizationId }).select('timesheet.submissionDeadline').lean();
      return {
        ...baseStats,
        pendingTimesheets: personalPending,
        approvedTimesheets: personalApproved,
        rejectedTimesheets: personalRejected,
        totalEmployees: await User.countDocuments({ organizationId, isActive: true, role: ROLES.EMPLOYEE }),
        totalManagers: await User.countDocuments({ organizationId, isActive: true, role: ROLES.MANAGER }),
        totalAdmins: await User.countDocuments({ organizationId, isActive: true, role: ROLES.ADMIN }),
        submissionDeadline: settingsDoc?.timesheet?.submissionDeadline || 'Friday 18:00'
      };
    },

  async getAdminKpiSummary(kpi, organizationId) {
    if (kpi === 'project-hours') {
      // Hours logged per project
      const data = await Timesheet.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
        { $unwind: '$rows' },
        {
          $addFields: {
            'rows.isLeaveRow': {
              $or: [
                { $in: ['$rows.category', ['Leave', 'Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Paternity', 'Permission']] }
              ]
            }
          }
        },
        {
          $group: {
            _id: { $cond: ['$rows.isLeaveRow', 'LEAVE_GROUP', '$rows.projectId'] },
            totalHours: { $sum: '$rows.totalHours' },
            isLeaveRow: { $max: '$rows.isLeaveRow' },
            submittedCount: {
              $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.SUBMITTED] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.APPROVED] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.REJECTED] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: 'projects',
            localField: '_id',
            foreignField: '_id',
            as: 'project',
          },
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            label: {
              $cond: [
                { $ifNull: ['$project.name', false] },
                '$project.name',
                { $cond: ['$isLeaveRow', 'Leave', 'Unknown'] }
              ]
            },
            code: {
              $cond: [
                { $ifNull: ['$project.code', false] },
                '$project.code',
                { $cond: ['$isLeaveRow', 'LEAVE-SYS', 'N/A'] }
              ]
            },
            totalHours: 1,
            submittedCount: 1,
            approvedCount: 1,
            rejectedCount: 1,
          },
        },
        {
          $match: {
            label: { $ne: 'Leave' },
            code: { $ne: 'LEAVE-SYS' }
          }
        },
        { $sort: { totalHours: -1 } },
      ]);

      const ProjectModel = mongoose.model('Project');
      const allActiveProjects = await ProjectModel.find({ status: 'active' }).select('name code budgetHours').lean();
      
      const mergedData = allActiveProjects.reduce((acc, p) => {
        if (p.name === 'Leave' || p.code === 'LEAVE-SYS') return acc;
        const existing = data.find(d => d.code === p.code || d.label === p.name);
        if (existing) {
          acc.push({ ...existing, budgetHours: p.budgetHours || 0 });
        } else {
          acc.push({
            label: p.name,
            code: p.code,
            totalHours: 0,
            submittedCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            budgetHours: p.budgetHours || 0
          });
        }
        return acc;
      }, []);

      mergedData.sort((a, b) => b.totalHours - a.totalHours);

      return { kpi: 'project-hours', data: mergedData };
    }

    if (kpi === 'status-overview') {
      // Breakdown of timesheet statuses
      const data = await Timesheet.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalHours: { $sum: '$totalHours' },
          },
        },
        { $project: { label: '$_id', count: 1, totalHours: 1 } },
      ]);
      return { kpi: 'status-overview', data };
    }

    if (kpi === 'employee-activity') {
      // Top employees by hours logged
      const data = await Timesheet.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
        {
          $group: {
            _id: '$userId',
            totalHours: { $sum: '$totalHours' },
            submittedCount: {
              $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.SUBMITTED] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.APPROVED] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.REJECTED] }, 1, 0] },
            },
            totalTimesheets: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'users',
            let: { userId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$userId'] }, organizationId: new mongoose.Types.ObjectId(organizationId) } }
            ],
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            label: { $ifNull: ['$user.name', 'Unknown'] },
            employeeId: { $ifNull: ['$user.employeeId', 'N/A'] },
            department: { $ifNull: ['$user.department', 'N/A'] },
            totalHours: 1,
            submittedCount: 1,
            approvedCount: 1,
            rejectedCount: 1,
            totalTimesheets: 1,
          },
        },
        { $sort: { totalHours: -1 } },
        { $limit: 15 },
      ]);
      return { kpi: 'employee-activity', data };
    }

    // Default: return combined overview
    const [projectHours, statusBreakdown] = await Promise.all([
      this.getAdminKpiSummary('project-hours', organizationId),
      this.getAdminKpiSummary('status-overview', organizationId),
    ]);
    return { kpi: 'overview', projectHours: projectHours.data, statusBreakdown: statusBreakdown.data };
  },

  async getAdminSummary(organizationId, query = {}) {
    const filter = { organizationId: new mongoose.Types.ObjectId(organizationId), status: { $nin: [TIMESHEET_STATUS.DRAFT, TIMESHEET_STATUS.FROZEN] } };
    if (query.userId) filter.userId = new mongoose.Types.ObjectId(query.userId);

    const stats = await Timesheet.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTimesheets: { $sum: 1 },
          pendingReview: { $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.SUBMITTED] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.APPROVED] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.REJECTED] }, 1, 0] } },
          drafts: { $sum: { $cond: [{ $eq: ['$status', TIMESHEET_STATUS.DRAFT] }, 1, 0] } },
          totalHours: { $sum: '$totalHours' }
        }
      }
    ]);

    const activeUsers = await User.countDocuments({ organizationId, isActive: true });

    return {
      totalTimesheets: stats[0]?.totalTimesheets || 0,
      pendingReview: stats[0]?.pendingReview || 0,
      approved: stats[0]?.approved || 0,
      rejected: stats[0]?.rejected || 0,
      drafts: stats[0]?.drafts || 0,
      totalHours: stats[0]?.totalHours || 0,
      totalEmployees: activeUsers
    };
  },

  async getAdminTimesheets(query, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { organizationId };

    if (query.userId) filter.userId = query.userId;
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $nin: [TIMESHEET_STATUS.DRAFT, TIMESHEET_STATUS.FROZEN] };
    }
    if (query.projectId) {
      filter['rows.projectId'] = query.projectId;
    }

    if (query.search && query.search.trim().length >= 2) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      const [userIds, projectIds] = await Promise.all([
        User.find({ organizationId, $or: [{ name: searchRegex }, { employeeId: searchRegex }] }).distinct('_id'),
        Project.find({ organizationId, $or: [{ name: searchRegex }, { code: searchRegex }] }).distinct('_id')
      ]);

      filter.$or = [
        { status: searchRegex },
        { rejectionReason: searchRegex },
        { userId: { $in: userIds } },
        { 'rows.projectId': { $in: projectIds } }
      ];
    }

    // Search by division or location
    if (query.division || query.location) {
      const userIds = await User.find({
        organizationId,
        ...(query.division && { division: query.division }),
        ...(query.location && { location: query.location }),
        isActive: true
      }).distinct('_id');
      filter.userId = { $in: userIds };
    }

    if (query.year) {
      const year = parseInt(query.year);
      filter.weekStartDate = {
        $gte: new Date(Date.UTC(year, 0, 1)),
        $lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
      };
    }

    if (query.week) {
      // If week is provided, it will override the year range filter
      filter.weekStartDate = new Date(query.week);
    }

    const [timesheets, total] = await Promise.all([
      Timesheet.find(filter)
        .populate('userId', 'name employeeId department division location')
        .populate('rows.projectId', 'name code')
        .sort({ weekStartDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Timesheet.countDocuments(filter),
    ]);

    return {
      data: timesheets,
      pagination: buildPaginationMeta(total, page, limit)
    };
  },

  async getAdminFilterOptions(organizationId) {
    const [projects, employees, locations, divisions, timeframes] = await Promise.all([
      Project.find({ organizationId, isActive: true, code: { $ne: 'LEAVE-SYS' } }).select('name code').sort('name').lean(),
      User.find({ organizationId, isActive: true }).select('name employeeId').sort('name').lean(),
      User.distinct('location', { organizationId, location: { $ne: null } }),
      User.distinct('division', { organizationId, division: { $ne: null } }),
      Timesheet.distinct('weekStartDate', { organizationId })
    ]);

    // Extract unique years
    const years = [...new Set(timeframes.map(d => new Date(d).getUTCFullYear().toString()))].sort().reverse();
    // Return raw weeks, frontend will format them
    const weeks = timeframes.map(d => d.toISOString()).sort().reverse();

    return { projects, employees, locations, divisions, years, weeks };
  }
};

module.exports = timesheetService;
module.exports.calculateWeeklyHours = calculateWeeklyHours;
