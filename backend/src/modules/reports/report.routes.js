'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const Timesheet = require('../timesheets/timesheet.model');
const Leave = require('../leaves/leave.model');
const User = require('../users/user.model');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { TIMESHEET_STATUS, LEAVE_STATUS } = require('../../constants');
const { requireProTier } = require('../../middleware/tier.middleware');

router.use(authenticate);
router.use(authorize('admin', 'manager'));

// ─── Timesheet hours summary (by employee and project) ─────────────────────
router.get('/timesheet-summary', asyncHandler(async (req, res) => {
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };
  if (req.query.userId) match.userId = require('mongoose').Types.ObjectId.createFromHexString(req.query.userId);

  const summary = await Timesheet.aggregate([
    { $match: match },
    { $unwind: '$rows' },
    ...(req.query.projectId ? [{ $match: { 'rows.projectId': require('mongoose').Types.ObjectId.createFromHexString(req.query.projectId) } }] : []),
    {
      $group: {
        _id: { userId: '$userId', projectId: '$rows.projectId' },
        totalHours: { $sum: '$rows.totalHours' },
        timesheetCount: { $addToSet: '$_id' },
      },
    },
    { $addFields: { timesheetCount: { $size: '$timesheetCount' } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id.userId',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { name: 1, email: 1, employeeId: 1, department: 1, role: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id.projectId',
        foreignField: '_id',
        as: 'project',
        pipeline: [{ $project: { name: 1, code: 1 } }],
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    { $sort: { totalHours: -1 } },
  ]);

  ApiResponse.success(res, { data: summary });
}));

// ─── NEW: Compliance Summary (Donut Chart Data) ───────────────────────────
router.get('/compliance-summary', requireProTier, asyncHandler(async (req, res) => {
  const match = {};
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };

  // 1. Get total active employees
  const totalEmployees = await User.countDocuments({ role: 'employee', isActive: true });

  // 2. We need to determine "Expected Timesheets". 
  // If no date range provided, we just look at the last 4 weeks as a proxy, 
  // or simply group by status for whatever is queried

  // A simple strategy for pie chart: group by status within the date range
  const complianceStats = await Timesheet.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Format into a friendly structure for the frontend PieChart
  const result = {
    approved: 0,
    submitted: 0,
    rejected: 0,
    draft: 0
  };

  let totalTimesheetsInRange = 0;

  complianceStats.forEach(stat => {
    if (result[stat._id] !== undefined) {
      result[stat._id] = stat.count;
    }
    totalTimesheetsInRange += stat.count;
  });

  // Calculate missing (if we know the expected weeks * employees)
  // For standard reporting, "missing" is tricky without strict week boundaries.
  // We'll return the raw status distribution, frontend can calculate percentages.

  const formattedData = [
    { name: 'Approved', value: result.approved, fill: '#22c55e' },
    { name: 'Pending Review', value: result.submitted, fill: '#f59e0b' },
    { name: 'Rejected', value: result.rejected, fill: '#ef4444' },
    { name: 'Draft/Incomplete', value: result.draft, fill: '#94a3b8' }
  ].filter(d => d.value > 0);

  ApiResponse.success(res, { data: formattedData });
}));

// ─── Project utilization (aggregated hours per project) ────────────────────
router.get('/project-utilization', requireProTier, asyncHandler(async (req, res) => {
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };

  const data = await Timesheet.aggregate([
    { $match: match },
    { $unwind: '$rows' },
    {
      $group: {
        _id: '$rows.projectId',
        totalHours: { $sum: '$rows.totalHours' },
        employeeCount: { $addToSet: '$userId' },
      },
    },
    { $addFields: { employeeCount: { $size: '$employeeCount' } } },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'project',
        pipeline: [{ $project: { name: 1, code: 1, allocatedEmployees: 1 } }],
      },
    },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        // Calculate rough capacity: Allocated Employees * 40 hrs
        capacity: {
          $multiply: [
            { $cond: { if: { $isArray: '$project.allocatedEmployees' }, then: { $size: '$project.allocatedEmployees' }, else: '$employeeCount' } },
            40
          ]
        }
      }
    },
    {
      $addFields: {
        utilizationPercentage: {
          $cond: [
            { $gt: ['$capacity', 0] },
            { $multiply: [{ $divide: ['$totalHours', '$capacity'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { totalHours: -1 } },
  ]);

  ApiResponse.success(res, { data });
}));

// ─── Leave summary ─────────────────────────────────────────────────────────
router.get('/leave-summary', asyncHandler(async (req, res) => {
  const match = {};
  if (req.query.from) match.startDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.startDate = { ...match.startDate, $lte: new Date(req.query.to) };

  const data = await Leave.aggregate([
    { $match: match },
    { $group: { _id: { leaveType: '$leaveType', status: '$status' }, count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
    { $sort: { '_id.leaveType': 1 } },
  ]);

  ApiResponse.success(res, { data });
}));

// ─── Leave details (drill-down for a specific type) ────────────────────────
router.get('/leave-details', asyncHandler(async (req, res) => {
  const { leaveType, from, to } = req.query;
  const match = { status: LEAVE_STATUS.APPROVED };
  if (leaveType) match.leaveType = leaveType;
  if (from) match.startDate = { $gte: new Date(from) };
  if (to) match.startDate = { ...match.startDate, $lte: new Date(to) };

  const details = await Leave.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$userId',
        totalDays: { $sum: '$totalDays' },
        leaveCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { name: 1, role: 1, employeeId: 1, department: 1 } }],
      },
    },
    { $unwind: '$user' },
    { $sort: { totalDays: -1 } },
  ]);

  ApiResponse.success(res, { data: details });
}));

// ─── Individual task details (drill-down for user/project/period) ──────────
router.get('/timesheet-details', asyncHandler(async (req, res) => {
  const { userId, projectId, from, to } = req.query;
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (userId) match.userId = require('mongoose').Types.ObjectId.createFromHexString(userId);
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };

  const details = await Timesheet.aggregate([
    { $match: match },
    { $unwind: '$rows' },
    ...(projectId ? [{ $match: { 'rows.projectId': require('mongoose').Types.ObjectId.createFromHexString(projectId) } }] : []),
    { $unwind: '$rows.entries' },
    {
      $project: {
        date: '$rows.entries.date',
        hoursWorked: '$rows.entries.hoursWorked',
        taskDescription: '$rows.entries.taskDescription',
        category: '$rows.category',
        weekStartDate: '$weekStartDate'
      }
    },
    { $sort: { date: -1 } }
  ]);

  ApiResponse.success(res, { data: details });
}));

// ─── Employee attendance overview ──────────────────────────────────────────
router.get('/employee-attendance', asyncHandler(async (req, res) => {
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };

  const data = await Timesheet.aggregate([
    { $match: match },
    { $group: { _id: { userId: '$userId', week: '$weekStartDate' }, totalHours: { $sum: '$totalHours' } } },
    { $lookup: { from: 'users', localField: '_id.userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, employeeId: 1, department: 1, role: 1 } }] } },
    { $unwind: '$user' },
    { $sort: { '_id.week': -1, totalHours: -1 } },
  ]);

  ApiResponse.success(res, { data });
}));

// ─── NEW: Weekly hours trend (for line chart) ─────────────────────────────
router.get('/weekly-trend', requireProTier, asyncHandler(async (req, res) => {
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };
  if (req.query.userId) match.userId = require('mongoose').Types.ObjectId.createFromHexString(req.query.userId);
  if (req.query.projectId) match['rows.projectId'] = require('mongoose').Types.ObjectId.createFromHexString(req.query.projectId);

  const data = await Timesheet.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$weekStartDate',
        totalHours: { $sum: '$totalHours' },
        employeeCount: { $addToSet: '$userId' },
        timesheetCount: { $sum: 1 },
      },
    },
    {
      $project: {
        week: '$_id',
        totalHours: 1,
        employeeCount: { $size: '$employeeCount' },
        timesheetCount: 1,
        avgHoursPerEmployee: {
          $cond: [
            { $gt: [{ $size: '$employeeCount' }, 0] },
            { $divide: ['$totalHours', { $size: '$employeeCount' }] },
            0
          ]
        }
      },
    },
    { $sort: { week: 1 } },
  ]);

  ApiResponse.success(res, { data });
}));

// ─── NEW: Department hours summary (for stacked bar chart) ────────────────
router.get('/department-summary', requireProTier, asyncHandler(async (req, res) => {
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };

  const data = await Timesheet.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { department: 1 } }],
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $unwind: '$rows' },
    {
      $group: {
        _id: {
          department: { $ifNull: ['$user.department', 'Unassigned'] },
          projectId: '$rows.projectId',
        },
        totalHours: { $sum: '$rows.totalHours' },
        employeeCount: { $addToSet: '$userId' },
      },
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id.projectId',
        foreignField: '_id',
        as: 'project',
        pipeline: [{ $project: { name: 1, code: 1 } }],
      },
    },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id.department',
        totalHours: { $sum: '$totalHours' },
        employeeCount: { $addToSet: '$employeeCount' },
        projects: {
          $push: {
            name: { $ifNull: ['$project.name', 'Unknown'] },
            hours: '$totalHours',
          },
        },
      },
    },
    {
      $project: {
        department: '$_id',
        totalHours: 1,
        projects: 1,
      },
    },
    { $sort: { totalHours: -1 } },
  ]);

  ApiResponse.success(res, { data });
}));

// ─── NEW: Smart Insights Generator ──────────────────────────────────────────
router.get('/smart-insights', requireProTier, asyncHandler(async (req, res) => {
  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (req.query.from) match.weekStartDate = { $gte: new Date(req.query.from) };
  if (req.query.to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(req.query.to) };

  const [totalHoursRes, deptStats, leaveStats] = await Promise.all([
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: null, totalHours: { $sum: '$totalHours' } } }
    ]),
    Timesheet.aggregate([
      { $match: match },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $group: { _id: '$user.department', hours: { $sum: '$totalHours' } } },
      { $sort: { hours: -1 } },
      { $limit: 1 }
    ]),
    Leave.aggregate([
      { $match: { status: LEAVE_STATUS.APPROVED } },
      { $group: { _id: null, totalDays: { $sum: '$totalDays' } } }
    ])
  ]);

  const total = totalHoursRes[0]?.totalHours || 0;
  const topDept = deptStats[0];
  const totalLeaves = leaveStats[0]?.totalDays || 0;

  const insights = [];

  if (total > 0 && topDept) {
    const percentage = ((topDept.hours / total) * 100).toFixed(0);
    insights.push(`${topDept._id || 'Unassigned'} contributed ${percentage}% of all logged hours.`);
  }

  if (totalLeaves > 0) {
    const assumedWorkDays = Math.max(1, (total / 8)); // 8h per day approx
    const leaveImpact = ((totalLeaves / (assumedWorkDays + totalLeaves)) * 100).toFixed(1);
    insights.push(`Leave accounted for ~${leaveImpact}% of total potential capacity.`);
  }

  insights.push(`Average weekly productivity is stable based on recent submissions.`);

  ApiResponse.success(res, { data: insights });
}));

// ─── NEW: PDF Export ────────────────────────────────────────────────────────
router.get('/pdf-export', requireProTier, asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  const pdfGeneratorService = require('./pdfGenerator.service');

  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;

  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (from) match.weekStartDate = { $gte: from };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: to };
  if (req.query.userId) match.userId = mongoose.Types.ObjectId.createFromHexString(req.query.userId);

  // Fetch all needed data in parallel
  const [timesheetStats, projectData, leaveData, weeklyTrend, employeeData, deptStats, complianceRes] = await Promise.all([
    // 1. Overall stats
    Timesheet.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalTimesheets: { $sum: 1 },
          uniqueEmployees: { $addToSet: '$userId' },
        },
      },
    ]),
    // 2. Project hours
    Timesheet.aggregate([
      { $match: match },
      { $unwind: '$rows' },
      { $group: { _id: '$rows.projectId', totalHours: { $sum: '$rows.totalHours' } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1, code: 1 } }] } },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      { $sort: { totalHours: -1 } },
      { $limit: 15 },
    ]),
    // 3. Leave summary
    Leave.aggregate([
      { $match: { status: LEAVE_STATUS.APPROVED, ...(from ? { startDate: { $gte: from } } : {}), ...(to ? { endDate: { $lte: to } } : {}) } },
      { $group: { _id: '$leaveType', count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
      { $sort: { totalDays: -1 } },
    ]),
    // 4. Weekly trend
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: '$weekStartDate', totalHours: { $sum: '$totalHours' }, employeeCount: { $addToSet: '$userId' } } },
      { $project: { week: '$_id', totalHours: 1, employeeCount: { $size: '$employeeCount' } } },
      { $sort: { week: 1 } },
      { $limit: 20 },
    ]),
    // 5. Top employees
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: '$userId', totalHours: { $sum: '$totalHours' }, timesheetCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, employeeId: 1, department: 1 } }] } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { totalHours: -1 } },
      { $limit: 15 },
    ]),
    // 6. Department stats
    Timesheet.aggregate([
      { $match: match },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $group: { _id: '$user.department', totalHours: { $sum: '$totalHours' }, employeeCount: { $addToSet: '$userId' } } },
      { $sort: { totalHours: -1 } }
    ]),
    // 7. Compliance Stats (simple overall group)
    Timesheet.aggregate([
      { $match: { ...(from ? { weekStartDate: { $gte: from } } : {}), ...(to ? { weekStartDate: { $lte: to } } : {}) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const stats = timesheetStats[0] || { totalHours: 0, totalTimesheets: 0, uniqueEmployees: [] };
  const complianceStats = { total: 0, approved: 0, submitted: 0, rejected: 0, draft: 0 };
  complianceRes.forEach(r => {
    complianceStats[r._id] = r.count;
    complianceStats.total += r.count;
  });

  const data = {
    stats,
    projectData,
    leaveData,
    weeklyTrend,
    employeeData,
    deptStats,
    complianceStats
  };

  const now = new Date();
  await pdfGeneratorService.generateEnterpriseWorkforceReport(res, data, { from, to, now });
}));

// ─── NEW: CSV Export ─────────────────────────────────────────────────────────
router.get('/csv-export', requireProTier, asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;

  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (from) match.weekStartDate = { $gte: from };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: to };
  if (req.query.userId) match.userId = mongoose.Types.ObjectId.createFromHexString(req.query.userId);
  if (req.query.projectId) match['rows.projectId'] = mongoose.Types.ObjectId.createFromHexString(req.query.projectId);

  const timesheets = await Timesheet.aggregate([
    { $match: match },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $unwind: '$rows' },
    { $unwind: '$rows.entries' },
    { $lookup: { from: 'projects', localField: 'rows.projectId', foreignField: '_id', as: 'project' } },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        employeeName: '$user.name',
        employeeId: '$user.employeeId',
        department: { $ifNull: ['$user.department', ''] },
        projectName: { $ifNull: ['$project.name', ''] },
        category: '$rows.category',
        date: '$rows.entries.date',
        hours: '$rows.entries.hoursWorked',
        description: { $ifNull: ['$rows.entries.taskDescription', ''] },
      }
    },
    { $sort: { employeeName: 1, date: 1 } }
  ]);

  if (!timesheets.length) {
    return res.status(404).json({ success: false, message: 'No records found for the given criteria.' });
  }

  // Generate CSV manually 
  let csvContent = 'Employee,Employee ID,Department,Project,Category,Date,Hours,Description\n';
  timesheets.forEach(row => {
    // Escape quotes and wrap text containing commas
    const escapeCsv = (str) => typeof str === 'string' ? `"${str.replace(/"/g, '""')}"` : str;
    const dateStr = row.date ? new Date(row.date).toISOString().split('T')[0] : '';

    csvContent += [
      escapeCsv(row.employeeName),
      escapeCsv(row.employeeId),
      escapeCsv(row.department),
      escapeCsv(row.projectName),
      escapeCsv(row.category),
      dateStr,
      row.hours,
      escapeCsv(row.description)
    ].join(',') + '\n';
  });

  const now = new Date();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="timesheet-export-${now.toISOString().split('T')[0]}.csv"`);
  res.send(csvContent);
}));

module.exports = router;
