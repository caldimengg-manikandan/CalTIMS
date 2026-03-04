'use strict';

const mongoose = require('mongoose');
const Leave = require('./leave.model');
const User = require('../users/user.model');
const Project = require('../projects/project.model');
const Timesheet = require('../timesheets/timesheet.model');
const AppError = require('../../shared/utils/AppError');
const { LEAVE_STATUS, ROLES, TIMESHEET_STATUS, LEAVE_TYPES } = require('../../constants');
const { parsePagination, buildPaginationMeta, buildSort } = require('../../shared/utils/pagination');
const { getWeekStart, getWeekEnd, formatDate } = require('../../shared/utils/dateHelpers');
const notificationService = require('../notifications/notification.service');

// ─── Helper: get or create the system "Leave" project ────────────────────────
async function getOrCreateLeaveProject(managerId) {
  let leaveProject = await Project.findOne({ code: 'LEAVE-SYS' });
  if (!leaveProject) {
    leaveProject = await Project.create({
      name: 'Leave',
      code: 'LEAVE-SYS',
      description: 'System project for approved leave entries',
      startDate: new Date('2020-01-01'),
      status: 'active',
      managerId,
      budget: 0,
      isActive: true,
    });
  }
  return leaveProject;
}

// ─── Helper: get all working days (Mon-Fri) between two dates ─────────────────
function getWorkingDaysBetween(startDate, endDate) {
  const days = [];
  const cur = new Date(startDate);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      days.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// ─── Helper: group dates by ISO week ─────────────────────────────────────────
function groupByWeek(dates) {
  const map = new Map();
  for (const date of dates) {
    const ws = getWeekStart(date);
    const key = ws.toISOString();
    if (!map.has(key)) map.set(key, { weekStart: ws, weekEnd: getWeekEnd(date), dates: [] });
    map.get(key).dates.push(date);
  }
  return [...map.values()];
}

// ─── Helper: create / upsert leave rows into weekly timesheet ─────────────────
async function createLeaveTimesheets(leave, approverId) {
  const leaveProject = await getOrCreateLeaveProject(approverId);
  const workingDays = getWorkingDaysBetween(leave.startDate, leave.endDate);
  if (!workingDays.length) return;

  const weeks = groupByWeek(workingDays);
  const category = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
  const hoursPerDay = leave.isHalfDay ? 4.5 : 9;

  for (const { weekStart, weekEnd, dates } of weeks) {
    const entries = dates.map((date) => ({
      date,
      hoursWorked: hoursPerDay,
      taskDescription: `${category} Leave${leave.isHalfDay ? ' (Half Day)' : ''}`,
      isLeave: true,
    }));

    // Find the single weekly document
    let timesheet = await Timesheet.findOne({ userId: leave.userId._id, weekStartDate: weekStart });

    if (!timesheet) {
      timesheet = new Timesheet({
        userId: leave.userId._id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: TIMESHEET_STATUS.DRAFT,
        rows: []
      });
    }

    // Upsert the specific leave row by finding an existing one robustly
    const existingRowIndex = timesheet.rows.findIndex(r => {
      const rowPid = r.projectId?._id || r.projectId;
      return String(rowPid) === String(leaveProject._id) && 
             r.category?.toLowerCase() === category.toLowerCase();
    });

    if (existingRowIndex > -1) {
      // Merge entries: add or update new leave dates
      const existingEntries = timesheet.rows[existingRowIndex].entries;
      entries.forEach(ne => {
        const foundIdx = existingEntries.findIndex(ee => formatDate(ee.date) === formatDate(ne.date));
        if (foundIdx > -1) {
          // Update existing entry (e.g. if hours changed or we are re-syncing)
          existingEntries[foundIdx].hoursWorked = ne.hoursWorked;
          existingEntries[foundIdx].taskDescription = ne.taskDescription;
          existingEntries[foundIdx].isLeave = true;
        } else {
          // Add new entry
          existingEntries.push(ne);
        }
      });
      
      // Safety Cleanup: Ensure we don't have ANY other duplicate rows of the same type in this week
      // (This fixes any existing corruption)
      timesheet.rows = timesheet.rows.filter((r, idx) => {
        if (idx === existingRowIndex) return true;
        const rowPid = r.projectId?._id || r.projectId;
        const isMatch = String(rowPid) === String(leaveProject._id) && 
                       r.category?.toLowerCase() === category.toLowerCase();
        return !isMatch;
      });
    } else {
      // Create a fresh row if none exists
      timesheet.rows.push({
        projectId: leaveProject._id,
        category,
        entries
      });
    }

    await timesheet.save();
  }
}

/**
 * Leave Management Service
 */
const leaveService = {
  async apply(data, userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const { startDate, endDate, leaveType, totalDays } = data;
    const sd = new Date(startDate);
    const ed = new Date(endDate);

    // 1. Check leave types and balance
    if (user.leaveBalance[leaveType] !== undefined) {
      if (user.leaveBalance[leaveType] < totalDays) {
        throw new AppError(`Insufficient ${leaveType} leave balance. Available: ${user.leaveBalance[leaveType]} days.`, 400);
      }
    }

    // 2. Check for overlapping pending or approved leave
    const existingConflict = await Leave.findOne({
      userId,
      status: { $in: [LEAVE_STATUS.APPROVED, LEAVE_STATUS.PENDING] },
      $or: [
        { startDate: { $lte: ed }, endDate: { $gte: sd } }
      ]
    });

    if (existingConflict) {
      const statusText = existingConflict.status === LEAVE_STATUS.APPROVED ? 'an approved' : 'a pending';
      throw new AppError(`You already have ${statusText} ${existingConflict.leaveType} leave for this period (${formatDate(existingConflict.startDate)} - ${formatDate(existingConflict.endDate)})`, 400);
    }

    const leave = await Leave.create({ ...data, userId });
    return leave;
  },

  async getAll(query, user) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    // If a specific userId is provided (admin filter), use it
    if (query.userId && mongoose.Types.ObjectId.isValid(query.userId)) {
      filter.userId = new mongoose.Types.ObjectId(query.userId);
    } 
    // Otherwise, if it's the standard "my leaves" view, filter by logged-in user
    else if (!query.isAdminView) {
      filter.userId = user._id;
    }

    if (query.status && query.status !== '') filter.status = query.status;
    if (query.leaveType && query.leaveType !== '') filter.leaveType = query.leaveType;
    if (query.search) {
      const userIds = await User.find({
        $or: [
          { name: new RegExp(query.search, 'i') },
          { employeeId: new RegExp(query.search, 'i') }
        ]
      }).distinct('_id');
      filter.userId = { $in: userIds };
    }

    const [leaves, total] = await Promise.all([
      Leave.find(filter)
        .populate('userId', 'name employeeId')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Leave.countDocuments(filter),
    ]);

    return { 
      leaves, 
      pagination: buildPaginationMeta(total, page, limit) 
    };
  },

  async getById(id, requestor) {
    const leave = await Leave.findById(id)
      .populate('userId', 'name employeeId department')
      .populate('approvedBy', 'name');
    if (!leave) throw new AppError('Leave record not found', 404);

    if (requestor.role === ROLES.EMPLOYEE && leave.userId._id.toString() !== requestor._id.toString()) {
      throw new AppError('Access denied', 403);
    }
    return leave;
  },

  async approve(id, approverId) {
    const leave = await Leave.findById(id).populate('userId');
    if (!leave) throw new AppError('Leave record not found', 404);
    
    if (leave.status !== LEAVE_STATUS.PENDING) {
       throw new AppError('Leave is not in pending status', 400);
    }

    const user = leave.userId;
    // Deduct balance
    if (user.leaveBalance && user.leaveBalance[leave.leaveType] !== undefined) {
      user.leaveBalance[leave.leaveType] -= leave.totalDays;
      if (user.leaveBalance[leave.leaveType] < 0) user.leaveBalance[leave.leaveType] = 0;
      await user.save();
    }

    leave.status = LEAVE_STATUS.APPROVED;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    await leave.save();

    // Auto-create/update the weekly timesheet
    await createLeaveTimesheets(leave, approverId);

    // Notify employee
    await notificationService.create({
      userId: leave.userId._id,
      type: 'leave_approved',
      title: '✅ Leave Approved',
      message: `Your ${leave.leaveType} leave application has been approved.`,
      refId: leave._id,
      refModel: 'Leave',
    });

    return leave;
  },

  async reject(id, approverId, reason) {
    const leave = await Leave.findById(id);
    if (!leave) throw new AppError('Leave record not found', 404);
    leave.status = LEAVE_STATUS.REJECTED;
    leave.rejectionReason = reason;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    await leave.save();
    return leave;
  },

  async cancel(id, requestorId, reason) {
    const leave = await Leave.findById(id);
    if (!leave) throw new AppError('Leave record not found', 404);

    if (leave.userId.toString() !== requestorId.toString()) {
      throw new AppError('You can only cancel your own leave requests', 403);
    }

    if (leave.status !== LEAVE_STATUS.PENDING) {
      throw new AppError('Only pending leave requests can be cancelled', 400);
    }

    leave.status = LEAVE_STATUS.CANCELLED;
    leave.cancellationReason = reason;
    await leave.save();
    return leave;
  },

  async syncTimesheet(id, adminId) {
    const leave = await Leave.findById(id).populate('userId');
    if (!leave) throw new AppError('Leave record not found', 404);
    if (leave.status !== LEAVE_STATUS.APPROVED) {
      throw new AppError('Can only sync timesheets for approved leaves', 400);
    }
    await createLeaveTimesheets(leave, adminId);
    return { message: 'Timesheets synced successfully' };
  },

  async backfillTimesheets(adminId) {
    const approvedLeaves = await Leave.find({ status: LEAVE_STATUS.APPROVED }).populate('userId');
    let synced = 0;
    let failed = 0;
    for (const leave of approvedLeaves) {
      try {
        await createLeaveTimesheets(leave, adminId);
        synced++;
      } catch (err) {
        console.error(`[Backfill] Failed for leave ${leave._id}: ${err.message}`);
        failed++;
      }
    }
    return { total: approvedLeaves.length, synced, failed };
  },

  async getBalance(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return { annual: 0, sick: 0, casual: 0 };
    }
    const user = await User.findById(userId).select('leaveBalance name employeeId');
    if (!user) throw new AppError('User not found', 404);
    return user.leaveBalance;
  },
};

module.exports = leaveService;
