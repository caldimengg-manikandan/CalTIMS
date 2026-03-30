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
const notifier = require('../../shared/services/notifier');
const { logAction } = require('../audit/audit.routes');
const policyService = require('../policyEngine/policy.service');

// ─── Helper: get or create the system "Leave" project ────────────────────────
async function getOrCreateLeaveProject(managerId, organizationId) {
  let leaveProject = await Project.findOne({ code: 'LEAVE-SYS', organizationId });
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
      organizationId,
    });
  }
  return leaveProject;
}

// ─── Helper: get all working days between two dates respecting organization settings ─
async function getWorkingDaysBetween(startDate, endDate, organizationId) {
  const policy = await policyService.getPolicy(organizationId);
  const workWeek = policy?.attendance?.workWeek || 'Mon-Fri';

  const days = [];
  const cur = new Date(startDate);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  while (cur <= end) {
    const day = cur.getUTCDay();
    let isWorkingDay = true;
    
    if (workWeek === 'Mon-Fri') {
      // 0 = Sunday, 6 = Saturday
      if (day === 0 || day === 6) isWorkingDay = false;
    } else if (workWeek === 'Sun-Thu') {
      // 5 = Friday, 6 = Saturday
      if (day === 5 || day === 6) isWorkingDay = false;
    }

    if (isWorkingDay) {
      days.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// ─── Helper: group dates by ISO week ─────────────────────────────────────────
async function getWeekStartDay(organizationId) {
  const policy = await policyService.getPolicy(organizationId);
  return policy?.attendance?.weekStartDay || 'monday';
}

function groupByWeek(dates, weekStartDay = 'monday') {
  const map = new Map();
  for (const date of dates) {
    const ws = getWeekStart(date, weekStartDay);
    const key = ws.toISOString();
    if (!map.has(key)) map.set(key, { weekStart: ws, weekEnd: getWeekEnd(date, weekStartDay), dates: [] });
    map.get(key).dates.push(date);
  }
  return [...map.values()];
}

// ─── Helper: remove leave rows from weekly timesheets when a leave is cancelled ─
async function removeLeaveTimesheets(leave, organizationId) {
  const leaveProject = await Project.findOne({ code: 'LEAVE-SYS', organizationId });
  if (!leaveProject) return; // No leave project means no timesheets to clean up

  const workingDays = await getWorkingDaysBetween(leave.startDate, leave.endDate, organizationId);
  if (!workingDays.length) return;

  const wsd = await getWeekStartDay(organizationId);
  const weeks = groupByWeek(workingDays, wsd);
  const category = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);

  for (const { weekStart, dates } of weeks) {
    const timesheet = await Timesheet.findOne({ userId: leave.userId._id || leave.userId, weekStartDate: weekStart, organizationId });
    if (!timesheet) continue;

    const rowIdx = timesheet.rows.findIndex(r => {
      const rowPid = r.projectId?._id || r.projectId;
      return String(rowPid) === String(leaveProject._id) &&
             r.category?.toLowerCase() === category.toLowerCase();
    });

    if (rowIdx === -1) continue;

    // Remove the specific leave date entries from the row
    const datesToRemove = new Set(dates.map(d => formatDate(d)));
    timesheet.rows[rowIdx].entries = timesheet.rows[rowIdx].entries.filter(
      e => !datesToRemove.has(formatDate(e.date))
    );

    // If the row has no more entries, remove the entire row
    if (timesheet.rows[rowIdx].entries.length === 0) {
      timesheet.rows.splice(rowIdx, 1);
    }

    await timesheet.save();
  }
}

// ─── Helper: create / upsert leave rows into weekly timesheet ─────────────────
async function createLeaveTimesheets(leave, approverId, organizationId) {
  const leaveProject = await getOrCreateLeaveProject(approverId, organizationId);
  const workingDays = await getWorkingDaysBetween(leave.startDate, leave.endDate, organizationId);
  if (!workingDays.length) return;

  const wsd = await getWeekStartDay(organizationId);
  const weeks = groupByWeek(workingDays, wsd);
  const category = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
  let hoursPerDay = 8;
  if (leave.isHalfDay) hoursPerDay = 4;
  if (leave.leaveType === LEAVE_TYPES.LOP) hoursPerDay = 0;

  for (const { weekStart, weekEnd, dates } of weeks) {
    const entries = dates.map((date) => ({
      date,
      hoursWorked: hoursPerDay,
      taskDescription: `${category} Leave${leave.isHalfDay ? ' (Half Day)' : ''}`,
      isLeave: true,
      leaveType: leave.leaveType, // Resolved type (may be 'lop' if balance was 0)
    }));

    // Find the single weekly document
    let timesheet = await Timesheet.findOne({ userId: leave.userId._id, weekStartDate: weekStart, organizationId });

    if (!timesheet) {
      timesheet = new Timesheet({
        userId: leave.userId._id,
        organizationId,
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
  async apply(data, userId, organizationId) {
    const user = await User.findOne({ _id: userId, organizationId });
    if (!user) throw new AppError('User not found', 404);

    let { startDate, endDate, leaveType } = data;
    leaveType = leaveType.toLowerCase();
    data.leaveType = leaveType;
    const sd = new Date(startDate);
    const ed = new Date(endDate);

    // 0. Recalculate totalDays based on actual working days (respecting work week settings)
    const workingDays = await getWorkingDaysBetween(sd, ed, organizationId);
    let totalDays = workingDays.length;

    if (data.isHalfDay) {
      if (totalDays === 0) {
        throw new AppError('The selected day is not a working day.', 400);
      }
      totalDays = 0.5;
    } else if (totalDays === 0) {
      throw new AppError('The selected date range does not contain any working days.', 400);
    }
    
    data.totalDays = totalDays;

    // 1. Check leave types and balance
    const balanceKey = leaveType.toLowerCase();
    if (user.leaveBalance && user.leaveBalance.has(balanceKey)) {
      const currentBalance = user.leaveBalance.get(balanceKey);
      if (currentBalance === 0) {
        leaveType = LEAVE_TYPES.LOP;
        data.leaveType = leaveType;
      } else if (currentBalance < totalDays) {
        throw new AppError(`Insufficient ${leaveType} leave balance. Available: ${currentBalance} days.`, 400);
      }
    }

    // 2. Check for overlapping pending or approved leave
    const existingConflict = await Leave.findOne({
      userId,
      organizationId,
      status: { $in: [LEAVE_STATUS.APPROVED, LEAVE_STATUS.PENDING] },
      $or: [
        { startDate: { $lte: ed }, endDate: { $gte: sd } }
      ]
    });

    if (existingConflict) {
      const statusText = existingConflict.status === LEAVE_STATUS.APPROVED ? 'an approved' : 'a pending';
      throw new AppError(`You already have ${statusText} ${existingConflict.leaveType} leave for this period (${formatDate(existingConflict.startDate)} - ${formatDate(existingConflict.endDate)})`, 400);
    }

    const leave = await Leave.create({ ...data, userId, organizationId });

    // Notify Admins, Managers, and Direct Manager
    const systemApprovers = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.MANAGER] }, isActive: true, organizationId }).select('_id email');
    const directManager = user.managerId ? await User.findOne({ _id: user.managerId, organizationId }).select('_id email') : null;

    const approverMap = new Map();
    systemApprovers.forEach(a => approverMap.set(a._id.toString(), a));
    if (directManager) approverMap.set(directManager._id.toString(), directManager);

    const uniqueApprovers = Array.from(approverMap.values());

    const notificationPromises = uniqueApprovers.map(approver => 
      notifier.send(approver._id, {
        userEmail: approver.email,
        type: 'leave_applied',
        title: 'New Leave Application',
        message: `${user.name} (${user.employeeId}) has applied for ${leave.leaveType} leave. Leave ID: ${leave.leaveId}`,
        refId: leave._id,
        refModel: 'Leave',
      })
    );
    await Promise.all(notificationPromises);

    logAction({
        userId,
        action: 'APPLY_LEAVE',
        entityType: 'Leave',
        entityId: leave._id,
        details: { leaveId: leave.leaveId, leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate }
    });

    return leave;
  },

  async getAll(query, user, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { organizationId };

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
    if (query.leaveId && query.leaveId !== '') filter.leaveId = new RegExp(query.leaveId, 'i');

    // Support filtering by leave date range (overlapping leaves)
    if (query.from || query.to) {
      const fromDate = query.from ? new Date(query.from) : new Date('2000-01-01');
      const toDate = query.to ? new Date(query.to) : new Date('9999-12-31');
      filter.startDate = { $lte: toDate };
      filter.endDate = { $gte: fromDate };
    }

    // Support filtering by application date range (Applied On)
    if (query.appliedFrom || query.appliedTo) {
      filter.createdAt = {};
      if (query.appliedFrom) filter.createdAt.$gte = new Date(query.appliedFrom);
      if (query.appliedTo) {
        const to = new Date(query.appliedTo);
        to.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    // Support filtering by duration (Total Days)
    if (query.minDays || query.maxDays) {
      filter.totalDays = {};
      if (query.minDays) filter.totalDays.$gte = Number(query.minDays);
      if (query.maxDays) filter.totalDays.$lte = Number(query.maxDays);
    }

    if (query.search && query.search.trim().length >= 2) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      const userIds = await User.find({
        organizationId,
        $or: [
          { name: searchRegex },
          { employeeId: searchRegex }
        ]
      }).distinct('_id');
      
      filter.$or = [
        { leaveId: searchRegex },
        { leaveType: searchRegex },
        { status: searchRegex },
        { reason: searchRegex },
        { userId: { $in: userIds } }
      ];
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

  async getById(id, requestor, organizationId) {
    const leave = await Leave.findOne({ _id: id, organizationId })
      .populate('userId', 'name employeeId department')
      .populate('approvedBy', 'name');
    if (!leave) throw new AppError('Leave record not found', 404);

    if (requestor.role === ROLES.EMPLOYEE && leave.userId._id.toString() !== requestor._id.toString()) {
      throw new AppError('Access denied', 403);
    }
    return leave;
  },

  async approve(id, approverId, organizationId) {
    const leave = await Leave.findOne({ _id: id, organizationId }).populate('userId');
    if (!leave) throw new AppError('Leave record not found', 404);
    
    if (leave.status !== LEAVE_STATUS.PENDING) {
       throw new AppError('Leave is not in pending status', 400);
    }

    const user = leave.userId;
    // Deduct balance
    const balanceKey = leave.leaveType.toLowerCase();
    if (user.leaveBalance && user.leaveBalance.has(balanceKey)) {
      let currentBalance = user.leaveBalance.get(balanceKey) || 0;
      currentBalance -= leave.totalDays;
      user.leaveBalance.set(balanceKey, Math.max(0, currentBalance));
      await user.save();
    }

    leave.status = LEAVE_STATUS.APPROVED;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    await leave.save();

    logAction({
        userId: approverId,
        action: 'APPROVE_LEAVE',
        entityType: 'Leave',
        entityId: id,
        details: { 
            leaveId: leave.leaveId, 
            ownerId: leave.userId?._id || leave.userId,
            ownerName: leave.userId?.name || 'Unknown'
        }
    });

    // Auto-create/update the weekly timesheet
    await createLeaveTimesheets(leave, approverId, organizationId);

    // Notify employee
    await notifier.send(leave.userId._id, {
      userEmail: leave.userId.email,
      type: 'leave_approved',
      title: '✅ Leave Approved',
      message: `Your ${leave.leaveType} leave application (${leave.leaveId}) has been approved.`,
      refId: leave._id,
      refModel: 'Leave',
    });

    return leave;
  },

  async reject(id, approverId, reason, organizationId) {
    const leave = await Leave.findOne({ _id: id, organizationId }).populate('userId');
    if (!leave) throw new AppError('Leave record not found', 404);
    leave.status = LEAVE_STATUS.REJECTED;
    leave.rejectionReason = reason;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    await leave.save();

    logAction({
        userId: approverId,
        action: 'REJECT_LEAVE',
        entityType: 'Leave',
        entityId: id,
        details: { 
            leaveId: leave.leaveId, 
            ownerId: leave.userId?._id || leave.userId,
            ownerName: leave.userId?.name || 'Unknown',
            reason 
        }
    });

    // Notify employee
    await notifier.send(leave.userId._id, {
      userEmail: leave.userId.email,
      type: 'leave_rejected',
      title: '❌ Leave Rejected',
      message: `Your ${leave.leaveType} leave application (${leave.leaveId}) was rejected. Reason: ${reason}`,
      refId: leave._id,
      refModel: 'Leave',
    });

    return leave;
  },

  async cancel(id, requestorId, reason, requestorRole, organizationId) {
    const leave = await Leave.findOne({ _id: id, organizationId }).populate('userId');
    if (!leave) throw new AppError('Leave record not found', 404);

    const isAdminOrManager = requestorRole === ROLES.ADMIN || requestorRole === ROLES.MANAGER;
    const isOwner = leave.userId._id.toString() === requestorId.toString();

    // Employees can only cancel their own leaves; admins/managers can cancel any leave
    if (!isOwner && !isAdminOrManager) {
      throw new AppError('You can only cancel your own leave requests', 403);
    }

    const wasApproved = leave.status === LEAVE_STATUS.APPROVED;
    const wasPending = leave.status === LEAVE_STATUS.PENDING;

    // Employees can only cancel PENDING leaves; admins/managers can cancel PENDING or APPROVED leaves
    if (!wasPending && !(wasApproved && isAdminOrManager)) {
      throw new AppError('Only pending leave requests can be cancelled', 400);
    }

    // ── Restore leave balance ONLY if the leave was approved (balance was deducted on approval) ──
    if (wasApproved) {
      const user = leave.userId;
      const balanceKey = leave.leaveType.toLowerCase();
      if (user.leaveBalance && user.leaveBalance.has(balanceKey)) {
        const currentBalance = user.leaveBalance.get(balanceKey) || 0;
        user.leaveBalance.set(balanceKey, currentBalance + leave.totalDays);
        await user.save();
      }
      // Remove timesheet entries created for this approved leave
      await removeLeaveTimesheets(leave, organizationId);
    }
    // If the leave was PENDING, balance was never deducted — nothing to restore.

    leave.status = LEAVE_STATUS.CANCELLED;
    leave.cancellationReason = reason;
    await leave.save();

    logAction({
        userId: requestorId,
        action: 'CANCEL_LEAVE',
        entityType: 'Leave',
        entityId: id,
        details: { 
            leaveId: leave.leaveId, 
            ownerId: leave.userId?._id || leave.userId,
            ownerName: leave.userId?.name || 'Unknown',
            reason 
        }
    });

    // Notify Admins and Managers (if cancelled by the employee themselves)
    const user = leave.userId;
    if (isOwner) {
      const approvers = await User.find({ role: { $in: [ROLES.ADMIN, ROLES.MANAGER] }, isActive: true, organizationId }).select('_id email');
      const notificationPromises = approvers.map(approver =>
        notifier.send(approver._id, {
          userEmail: approver.email,
          type: 'leave_cancelled',
          title: 'Leave Cancelled',
          message: `${user.name} (${user.employeeId}) has cancelled their ${leave.leaveType} leave (${leave.leaveId}).`,
          refId: leave._id,
          refModel: 'Leave',
        })
      );
      await Promise.all(notificationPromises);
    } else {
      // Notify the employee that their leave was cancelled by an admin/manager
      await notifier.send(user._id, {
        userEmail: user.email,
        type: 'leave_cancelled',
        title: '❌ Leave Cancelled',
        message: `Your ${leave.leaveType} leave (${leave.leaveId}) has been cancelled by management${reason ? '. Reason: ' + reason : ''}.`,
        refId: leave._id,
        refModel: 'Leave',
      });
    }

    return leave;
  },

  async syncTimesheet(id, adminId, organizationId) {
    const leave = await Leave.findOne({ _id: id, organizationId }).populate('userId');
    if (!leave) throw new AppError('Leave record not found', 404);
    if (leave.status !== LEAVE_STATUS.APPROVED) {
      throw new AppError('Can only sync timesheets for approved leaves', 400);
    }
    await createLeaveTimesheets(leave, adminId, organizationId);
    return { message: 'Timesheets synced successfully' };
  },

  async backfillTimesheets(adminId, organizationId) {
    const approvedLeaves = await Leave.find({ status: LEAVE_STATUS.APPROVED, organizationId }).populate('userId');
    let synced = 0;
    let failed = 0;
    for (const leave of approvedLeaves) {
      try {
        await createLeaveTimesheets(leave, adminId, organizationId);
        synced++;
      } catch (err) {
        console.error(`[Backfill] Failed for leave ${leave._id}: ${err.message}`);
        failed++;
      }
    }
    return { total: approvedLeaves.length, synced, failed };
  },

  async getBalance(userId, organizationId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return { annual: 0, sick: 0, casual: 0 };
    }
    const user = await User.findOne({ _id: userId, organizationId }).select('leaveBalance name employeeId');
    if (!user) throw new AppError('User not found', 404);
    return user.leaveBalance;
  },

  async getFilterOptions(organizationId) {
    const Settings = mongoose.model('Settings');
    const [leaveIds, statuses, leaveTypesInUse, settings] = await Promise.all([
      Leave.distinct('leaveId', { organizationId }),
      Leave.distinct('status', { organizationId }),
      Leave.distinct('leaveType', { organizationId }),
      policyService.getPolicy(organizationId)
    ]);

    // Merge leave types from settings with those already in use
    const settingsTypes = (settings?.leave?.types || []).map(t => t.name);
    const allLeaveTypes = [...new Set([...settingsTypes, ...leaveTypesInUse])];

    return {
      leaveIds: leaveIds.filter(Boolean).sort(),
      statuses: statuses.filter(Boolean).sort(),
      leaveTypes: allLeaveTypes.filter(Boolean).sort(),
    };
  },
};

module.exports = leaveService;
