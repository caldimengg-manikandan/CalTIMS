'use strict';

const mongoose = require('mongoose');
const Timesheet = require('./timesheet.model');
const Project = require('../projects/project.model');
const User = require('../users/user.model');
const CalendarEvent = require('../calendar/calendar.model');
const AppError = require('../../shared/utils/AppError');
const { TIMESHEET_STATUS, ROLES, CALENDAR_EVENT_TYPES } = require('../../constants');
const { parsePagination, buildPaginationMeta, buildSort } = require('../../shared/utils/pagination');
const { getWeekStart, getWeekEnd } = require('../../shared/utils/dateHelpers');
const notificationService = require('../notifications/notification.service');

// ─── Leave-aware weekly hours calculator ─────────────────────────────────────
// This is the canonical implementation of the timesheet hour calculation rules:
//
//   IF entry.isLeave AND leaveType in [annual, sick, casual]
//       → hours = 8 (full paid day) or 4 (half-day, when hoursWorked === 4)
//   IF entry.isLeave AND leaveType === 'lop'
//       → hours = 0  (Loss of Pay: not counted)
//   ELSE (normal work entry)
//       → hours = entry.hoursWorked
//
// Weekly total < 40  →  isIncomplete = true
//
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
async function getWeekStartDay() {
  const Settings = mongoose.model('Settings');
  const settings = await Settings.findOne().select('general.weekStartDay').lean();
  return settings?.general?.weekStartDay || 'monday';
}

const timesheetService = {
  // ─── Core CRUD ──────────────────────────────────────────────────────────────
  async create(data, userId) {
    const wsd = await getWeekStartDay();
    const weekStart = getWeekStart(data.weekStartDate, wsd);
    const weekEnd = getWeekEnd(weekStart, wsd);

    // Ensure no existing timesheet for this week
    const existing = await Timesheet.findOne({ userId, weekStartDate: weekStart });
    if (existing) throw new AppError('Timesheet already exists for this week', 400);

    const ts = await Timesheet.create({
      userId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: TIMESHEET_STATUS.DRAFT,
      rows: []
    });
    return ts;
  },

  async update(id, data, userId) {
    const ts = await Timesheet.findById(id);
    if (!ts) throw new AppError('Timesheet not found', 404);
    if (ts.userId.toString() !== userId.toString()) throw new AppError('Unauthorized', 403);
    if (ts.status === TIMESHEET_STATUS.FROZEN) {
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
    return ts;
  },

  async getById(id, requestor) {
    const timesheet = await Timesheet.findById(id)
      .populate('userId', 'name email employeeId department')
      .populate('rows.projectId', 'name code')
      .populate('approvedBy', 'name email');

    if (!timesheet) throw new AppError('Timesheet not found', 404);

    if (requestor.role === ROLES.EMPLOYEE && timesheet.userId._id.toString() !== requestor._id.toString()) {
      throw new AppError('You do not have permission to view this timesheet', 403);
    }

    return timesheet;
  },

  async getAll(query, requestor) {
    const { page, limit, skip } = parsePagination(query);
    const sort = buildSort(query, { weekStartDate: -1 });
    const filter = {};

    // Allow admins/managers to specify a userId, otherwise default to self
    if ((requestor.role === ROLES.ADMIN || requestor.role === ROLES.MANAGER) && query.userId) {
      filter.userId = query.userId;
    } else {
      filter.userId = requestor._id;
    }

    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      const wsd = await getWeekStartDay();
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
      const wsd = await getWeekStartDay();
      const ws = getWeekStart(new Date(query.weekStartDate), wsd);
      const we = getWeekEnd(ws, wsd);

      holidays = await CalendarEvent.find({
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

  async bulkUpsert(dataArray, userId) {
    if (!dataArray.length) return [];

    // 1. Group input by week (redundant since usually one week is sent, but safe)
    const wsd = await getWeekStartDay();
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

      let timesheet = await Timesheet.findOne({ userId, weekStartDate: weekStart });

      if (!timesheet) {
        timesheet = new Timesheet({
          userId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          status: TIMESHEET_STATUS.DRAFT,
          rows: []
        });
      }

      if (timesheet.status === TIMESHEET_STATUS.FROZEN) {
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
      results.push(timesheet);
    }
    return results;
  },

  async adminFill(dataArray, targetUserId, adminId) {
    if (!dataArray.length) return [];

    const wsd = await getWeekStartDay();
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

      let timesheet = await Timesheet.findOne({ userId: targetUserId, weekStartDate: weekStart });

      if (!timesheet) {
        timesheet = new Timesheet({
          userId: targetUserId,
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
      results.push(timesheet);
    }
    return results;
  },

  async validateLimits(timesheet) {
    const Settings = mongoose.model('Settings');
    const settingsDoc = await Settings.findOne().lean();
    const limits = settingsDoc?.timesheet || {};

    // 0 means no limit
    if (!limits.maxEntriesPerDay && !limits.maxEntriesPerWeek) return;

    const entriesByDay = {}; // YYYY-MM-DD -> count
    let totalEntries = 0;

    timesheet.rows.forEach(row => {
      row.entries.forEach(e => {
        if (e.hoursWorked > 0) {
          try {
            const dateStr = new Date(e.date).toISOString().split('T')[0];
            entriesByDay[dateStr] = (entriesByDay[dateStr] || 0) + 1;
            totalEntries++;
          } catch (err) {
            // Skip invalid dates
          }
        }
      });
    });

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
  },

  async bulkSubmit(dataArray, userId) {
    // Reuses bulkUpsert to save, then sets status to SUBMITTED
    const savedTimesheets = await this.bulkUpsert(dataArray, userId);

    const user = await User.findById(userId).select('name employeeId');
    const approvers = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.MANAGER] }, isActive: true }).select('_id');

    for (const ts of savedTimesheets) {
      ts.status = TIMESHEET_STATUS.SUBMITTED;
      ts.submittedAt = new Date();
      await ts.save();

      // Notify Admins and Managers for each week submitted
      const weekStr = ts.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const year = ts.weekStartDate.getFullYear();

      const notificationPromises = approvers.map(approver =>
        notificationService.create({
          userId: approver._id,
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

  async submit(id, requestor) {
    const ts = await Timesheet.findById(id);
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

    // Notify Admins and Managers
    const user = await User.findById(ts.userId).select('name employeeId');
    const approvers = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.MANAGER] }, isActive: true }).select('_id');
    const weekStr = ts.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = ts.weekStartDate.getFullYear();

    const notificationPromises = approvers.map(approver =>
      notificationService.create({
        userId: approver._id,
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

  async approve(id, approverId) {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new AppError('Timesheet not found', 404);
    if (timesheet.status !== TIMESHEET_STATUS.SUBMITTED) {
      throw new AppError('Only submitted timesheets can be approved', 400);
    }

    timesheet.status = TIMESHEET_STATUS.APPROVED;
    timesheet.approvedBy = approverId;
    timesheet.approvedAt = new Date();
    await timesheet.save();

    // Notify employee
    const approver = await User.findById(approverId).select('name');
    const weekStr = timesheet.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = timesheet.weekStartDate.getFullYear();

    await notificationService.create({
      userId: timesheet.userId,
      type: 'timesheet_approved',
      title: '✅ Timesheet Approved',
      message: `Your timesheet for the week of ${weekStr} (${year}) has been approved by ${approver?.name || 'Admin'}.`,
      refId: timesheet._id,
      refModel: 'Timesheet',
    });

    return timesheet;
  },

  async reject(id, approverId, reason) {
    if (!reason) throw new AppError('Rejection reason is required', 400);
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new AppError('Timesheet not found', 404);

    timesheet.status = TIMESHEET_STATUS.REJECTED;
    timesheet.rejectionReason = reason;
    await timesheet.save();

    const approver = await User.findById(approverId).select('name');
    const weekStr = timesheet.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = timesheet.weekStartDate.getFullYear();

    await notificationService.create({
      userId: timesheet.userId,
      type: 'timesheet_rejected',
      title: '❌ Timesheet Rejected',
      message: `Your timesheet for the week of ${weekStr} (${year}) was rejected by ${approver?.name || 'Admin'}: "${reason}".`,
      refId: timesheet._id,
      refModel: 'Timesheet',
    });

    return timesheet;
  },

  async delete(id, requestor) {
    const timesheet = await Timesheet.findById(id);
    if (!timesheet) throw new AppError('Timesheet not found', 404);
    if (requestor.role !== ROLES.ADMIN && timesheet.userId.toString() !== requestor._id.toString()) {
      throw new AppError('Unauthorized', 403);
    }
    await timesheet.deleteOne();
    return true;
  },

  // ─── Reporting ─────────────────────────────────────────────────────────────

  async getCompliance(query) {
    const { weekStartDate } = query;
    if (!weekStartDate) throw new AppError('Week start date is required', 400);

    const Settings = mongoose.model('Settings');
    const settings = await Settings.findOne().select('general.weekStartDay').lean();
    const wsd = settings?.general?.weekStartDay || 'monday';
    const weekStart = getWeekStart(new Date(weekStartDate), wsd);

    const employees = await User.find({ role: ROLES.EMPLOYEE, isActive: true })
      .select('name employeeId email department')
      .lean();

    const timesheets = await Timesheet.find({ weekStartDate: weekStart }).lean();
    const tsMap = new Map(timesheets.map(ts => [ts.userId.toString(), ts]));

    const complianceData = employees.map(emp => {
      const ts = tsMap.get(emp._id.toString());
      return {
        user: emp,
        status: ts ? ts.status : 'missing',
        timesheetId: ts ? ts._id : null,
        totalHours: ts ? ts.totalHours : 0,
        frozenAt: ts ? ts.frozenAt : null
      };
    });

    return complianceData;
  },

  async getHistory(query, requestor) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

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

  async getDashboardSummary(userId, role, query = {}) {
    const isAllWeeks = query.weekStartDate === 'all';
    const weekStart = isAllWeeks ? null : (query.weekStartDate ? getWeekStart(new Date(query.weekStartDate)) : getWeekStart(new Date()));
    const projectId = query.projectId && query.projectId !== 'all' ? query.projectId : null;

    // Employee & Manager: strictly their own data only
    const isPersonal = role === ROLES.EMPLOYEE || role === ROLES.MANAGER;

    if (isPersonal) {
      const timesheetFilter = { userId };
      if (!isAllWeeks) timesheetFilter.weekStartDate = weekStart;

      const [weekly, pending, approved, rejected, totalEmployees, totalManagers, totalAdmins] = await Promise.all([
        !isAllWeeks ? Timesheet.findOne(timesheetFilter) : null,
        Timesheet.countDocuments({ userId, status: TIMESHEET_STATUS.SUBMITTED }),
        Timesheet.countDocuments({ userId, status: TIMESHEET_STATUS.APPROVED }),
        Timesheet.countDocuments({ userId, status: TIMESHEET_STATUS.REJECTED }),
        User.countDocuments({ isActive: true, role: ROLES.EMPLOYEE }),
        User.countDocuments({ isActive: true, role: ROLES.MANAGER }),
        User.countDocuments({ isActive: true, role: ROLES.ADMIN }),
      ]);

      // Calculate daily breakdown for the chart
      let dailyBreakdown = [
        { day: 'Mon', hours: 0 }, { day: 'Tue', hours: 0 }, { day: 'Wed', hours: 0 },
        { day: 'Thu', hours: 0 }, { day: 'Fri', hours: 0 }, { day: 'Sat', hours: 0 }, { day: 'Sun', hours: 0 }
      ];
      if (weekly?.rows) {
        weekly.rows.forEach(row => {
          row.entries.forEach(entry => {
            const dateStr = new Date(entry.date).toISOString().split('T')[0];
            const dateObj = new Date(entry.date);
            const dayIdx = dateObj.getDay() || 7; // 1-7 (Mon-Sun)
            if (dayIdx >= 1 && dayIdx <= 7) {
              dailyBreakdown[dayIdx - 1].hours += (entry.hoursWorked || 0);
            }
          });
        });
      }

      return {
        hoursThisWeek: weekly?.totalHours || 0,
        dailyHours: dailyBreakdown,
        pendingTimesheets: pending,
        approvedTimesheets: approved,
        rejectedTimesheets: rejected,
        totalEmployees: totalEmployees,
        totalManagers,
        totalAdmins
      };
    }

    // Admin Level Stats
    let activeUsers = [];
    let activeManagers = 0;
    let activeAdmins = 0;

    if (projectId) {
      // Find employees specifically allocated to this project
      const Project = mongoose.model('Project');
      const projectDoc = await Project.findById(projectId)
        .populate('allocatedEmployees.userId', 'name employeeId department isActive role')
        .lean();

      if (projectDoc) {
        activeUsers = projectDoc.allocatedEmployees
          .map(a => a.userId)
          .filter(u => u && u.isActive !== false && u.role === ROLES.EMPLOYEE);

        // Note: Project allocation usually only tracks employees, but if we need counts:
        activeManagers = await User.countDocuments({ isActive: true, role: ROLES.MANAGER });
        activeAdmins = await User.countDocuments({ isActive: true, role: ROLES.ADMIN });
      }
    } else {
      activeUsers = await User.find({ isActive: true, role: ROLES.EMPLOYEE }).select('name employeeId department').lean();
      activeManagers = await User.countDocuments({ isActive: true, role: ROLES.MANAGER });
      activeAdmins = await User.countDocuments({ isActive: true, role: ROLES.ADMIN });
    }

    const timesheetFilter = {};
    if (!isAllWeeks) timesheetFilter.weekStartDate = weekStart;
    if (projectId) {
      timesheetFilter['rows.projectId'] = new mongoose.Types.ObjectId(projectId);
    }

    const allTimesheets = await Timesheet.find(timesheetFilter)
      .populate('userId', 'name employeeId department')
      .populate('rows.projectId', 'name code')
      .lean();

    const submitted = allTimesheets.filter(ts => ts.status !== TIMESHEET_STATUS.DRAFT);
    const submittedUserIds = submitted.map(ts => ts.userId?._id?.toString()).filter(Boolean);

    // Not submitted: active employees who don't have a non-draft timesheet for this week/project
    const notSubmitted = activeUsers.filter(u => !submittedUserIds.includes(u._id.toString()));

    const projectTotals = await Timesheet.aggregate([
      { $match: { ...timesheetFilter } }, // Use the already built filter which handles 'all' correctly
      { $unwind: '$rows' },
      {
        $group: {
          _id: '$rows.projectId',
          totalHours: { $sum: '$rows.totalHours' },
          timesheetCount: { $addToSet: '$_id' }
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project'
        }
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          projectName: '$project.name',
          projectCode: '$project.code',
          totalHours: 1,
          timesheetCount: { $size: '$timesheetCount' }
        }
      },
      {
        $match: {
          projectName: { $nin: ['Leave', null] },
          projectCode: { $ne: 'LEAVE-SYS' }
        }
      },
      { $sort: { totalHours: -1 } }
    ]);

    const ProjectModel = mongoose.model('Project');
    const allActiveProjects = await ProjectModel.find({ status: 'active' }).lean();
    
    // Merge active projects that might not have any timesheets
    const mergedProjectTotals = allActiveProjects.reduce((acc, p) => {
      if (p.name === 'Leave' || p.code === 'LEAVE-SYS') return acc;
      const existing = projectTotals.find(pt => pt.projectCode === p.code || pt.projectName === p.name);
      if (existing) {
        acc.push(existing);
      } else {
        acc.push({
          projectName: p.name,
          projectCode: p.code,
          totalHours: 0,
          timesheetCount: 0
        });
      }
      return acc;
    }, []);

    mergedProjectTotals.sort((a, b) => b.totalHours - a.totalHours);

    return {
      submittedCount: submitted.length,
      notSubmittedCount: notSubmitted.length,
      submittedEmployees: submitted.map(ts => ({
        id: ts.userId?._id,
        name: ts.userId?.name,
        employeeId: ts.userId?.employeeId,
        department: ts.userId?.department,
        totalHours: ts.totalHours,
        status: ts.status,
        projects: ts.rows.map(r => r.projectId?.name).filter(Boolean).join(', ')
      })),
      notSubmittedEmployees: notSubmitted,
      totalEmployees: activeUsers.length,
      totalManagers: activeManagers,
      totalAdmins: activeAdmins,
      projectTotals: mergedProjectTotals,
      totalTimesheets: allTimesheets.length,
      pendingTimesheets: submitted.filter(ts => ts.status === TIMESHEET_STATUS.SUBMITTED).length,
      approvedTimesheets: submitted.filter(ts => ts.status === TIMESHEET_STATUS.APPROVED).length,
      rejectedTimesheets: submitted.filter(ts => ts.status === TIMESHEET_STATUS.REJECTED).length,
    };
  },

  async getAdminKpiSummary(kpi) {
    if (kpi === 'project-hours') {
      // Hours logged per project
      const data = await Timesheet.aggregate([
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
      const allActiveProjects = await ProjectModel.find({ status: 'active' }).lean();
      
      const mergedData = allActiveProjects.reduce((acc, p) => {
        if (p.name === 'Leave' || p.code === 'LEAVE-SYS') return acc;
        const existing = data.find(d => d.code === p.code || d.label === p.name);
        if (existing) {
          acc.push(existing);
        } else {
          acc.push({
            label: p.name,
            code: p.code,
            totalHours: 0,
            submittedCount: 0,
            approvedCount: 0,
            rejectedCount: 0
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
            localField: '_id',
            foreignField: '_id',
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
      this.getAdminKpiSummary('project-hours'),
      this.getAdminKpiSummary('status-overview'),
    ]);
    return { kpi: 'overview', projectHours: projectHours.data, statusBreakdown: statusBreakdown.data };
  },

  async getAdminSummary(query = {}) {
    const filter = { status: { $ne: TIMESHEET_STATUS.DRAFT } };
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

    const activeUsers = await User.countDocuments({ isActive: true });

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

  async getAdminTimesheets(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    if (query.userId) filter.userId = query.userId;
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $ne: TIMESHEET_STATUS.DRAFT };
    }
    if (query.projectId) {
      filter['rows.projectId'] = query.projectId;
    }

    if (query.search && query.search.trim().length >= 2) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      const [userIds, projectIds] = await Promise.all([
        User.find({ $or: [{ name: searchRegex }, { employeeId: searchRegex }] }).distinct('_id'),
        Project.find({ $or: [{ name: searchRegex }, { code: searchRegex }] }).distinct('_id')
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

  async getAdminFilterOptions() {
    const [projects, employees, locations, divisions] = await Promise.all([
      Project.find({ isActive: true, code: { $ne: 'LEAVE-SYS' } }).select('name code').sort('name').lean(),
      User.find({ isActive: true }).select('name employeeId').sort('name').lean(),
      User.distinct('location', { location: { $ne: null } }),
      User.distinct('division', { division: { $ne: null } })
    ]);

    return { projects, employees, locations, divisions };
  }
};

module.exports = timesheetService;
module.exports.calculateWeeklyHours = calculateWeeklyHours;
