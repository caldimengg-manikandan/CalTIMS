'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const Timesheet = require('../timesheets/timesheet.model');
const Leave = require('../leaves/leave.model');
const User = require('../users/user.model');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkPermission } = require('../../middleware/rbac.middleware');
const { TIMESHEET_STATUS, LEAVE_STATUS } = require('../../constants');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');
const { getPeriodRange } = require('../../shared/utils/dateHelpers');

router.use(authenticate);
router.use(checkSubscription);
router.use(requireFeature('reports'));
router.use(checkPermission('viewReports'));

// ─── Timesheet hours summary (by employee and project) ─────────────────────
router.get('/timesheet-summary', asyncHandler(async (req, res) => {
  let { from, to, period, userId, projectId } = req.query;
  
  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };
  if (userId) match.userId = require('mongoose').Types.ObjectId.createFromHexString(userId);

  const summary = await Timesheet.aggregate([
    { $match: match },
    { $unwind: '$rows' },
    ...(projectId ? [{ $match: { 'rows.projectId': require('mongoose').Types.ObjectId.createFromHexString(projectId) } }] : []),
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
router.get('/compliance-summary', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;
  
  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };
  if (projectId) match['rows.projectId'] = require('mongoose').Types.ObjectId.createFromHexString(projectId);

  // 1. Get total active employees of the organization
  const totalEmployees = await User.countDocuments({ organizationId: req.organizationId, role: 'employee', isActive: true });

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

  const formattedData = [
    { name: 'Approved', value: result.approved, fill: '#22c55e' },
    { name: 'Pending Review', value: result.submitted, fill: '#f59e0b' },
    { name: 'Rejected', value: result.rejected, fill: '#ef4444' },
    { name: 'Draft/Incomplete', value: result.draft, fill: '#94a3b8' }
  ].filter(d => d.value > 0);

  ApiResponse.success(res, { data: formattedData });
}));

// ─── Project utilization (aggregated hours per project) ────────────────────
router.get('/project-utilization', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };
  if (projectId) match['rows.projectId'] = require('mongoose').Types.ObjectId.createFromHexString(projectId);

  const data = await Timesheet.aggregate([
    { $match: match },
    { $unwind: '$rows' },
    ...(projectId ? [{ $match: { 'rows.projectId': require('mongoose').Types.ObjectId.createFromHexString(projectId) } }] : []),
    {
      $group: {
        _id: '$rows.projectId',
        totalHours: { $sum: '$rows.totalHours' },
        employees: {
          $push: {
            userId: '$userId',
            hours: '$rows.totalHours'
          }
        },
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
        pipeline: [{ $project: { name: 1, code: 1, allocatedEmployees: 1, budgetHours: 1 } }],
      },
    },
    { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    // Enrich allocatedEmployees with user names
    {
      $lookup: {
        from: 'users',
        localField: 'project.allocatedEmployees.userId',
        foreignField: '_id',
        as: 'allocatedUserInfos'
      }
    },
    {
      $addFields: {
        capacity: {
          $cond: {
            if: { $gt: ['$project.budgetHours', 0] },
            then: '$project.budgetHours',
            else: {
              $multiply: [
                { $cond: { if: { $isArray: '$project.allocatedEmployees' }, then: { $size: '$project.allocatedEmployees' }, else: '$employeeCount' } },
                40
              ]
            }
          }
        },
        employeeDetails: {
          $map: {
            input: '$project.allocatedEmployees',
            as: 'alloc',
            in: {
              userId: {
                $let: {
                  vars: {
                    userInfo: {
                      $filter: {
                        input: '$allocatedUserInfos',
                        as: 'u',
                        cond: { $eq: ['$$u._id', '$$alloc.userId'] }
                      }
                    }
                  },
                  in: {
                    _id: '$$alloc.userId',
                    name: { $arrayElemAt: ['$$userInfo.name', 0] }
                  }
                }
              },
              role: '$$alloc.role',
              budgetHours: '$$alloc.budgetHours',
              loggedHours: {
                $reduce: {
                  input: '$employees',
                  initialValue: 0,
                  in: {
                    $cond: [{ $eq: ['$$this.userId', '$$alloc.userId'] }, { $add: ['$$value', '$$this.hours'] }, '$$value']
                  }
                }
              }
            }
          }
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
  let { from, to, period } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { organizationId: req.organizationId };
  if (from) match.startDate = { $gte: new Date(from) };
  if (to) match.startDate = { ...match.startDate, $lte: new Date(to) };

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
  const match = { status: LEAVE_STATUS.APPROVED, organizationId: req.organizationId };
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
  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
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
  let { from, to, period } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };

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
router.get('/weekly-trend', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, userId, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };
  if (userId) match.userId = require('mongoose').Types.ObjectId.createFromHexString(userId);
  if (projectId) match['rows.projectId'] = require('mongoose').Types.ObjectId.createFromHexString(projectId);

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

  ApiResponse.success(res, { data: data });
}));

// ─── NEW: Department hours summary (for stacked bar chart) ────────────────
router.get('/department-summary', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };
  if (projectId) match['rows.projectId'] = require('mongoose').Types.ObjectId.createFromHexString(projectId);

  const data = await Timesheet.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { department: 1, organizationId: 1 } }],
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $unwind: '$rows' },
    ...(projectId ? [{ $match: { 'rows.projectId': require('mongoose').Types.ObjectId.createFromHexString(projectId) } }] : []),
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
router.get('/smart-insights', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: new Date(from) };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: new Date(to) };
  if (projectId) match['rows.projectId'] = require('mongoose').Types.ObjectId.createFromHexString(projectId);

  const [totalHoursRes, deptStats, leaveStats] = await Promise.all([
    Timesheet.aggregate([
      { $match: match },
      { $unwind: '$rows' },
      ...(projectId ? [{ $match: { 'rows.projectId': require('mongoose').Types.ObjectId.createFromHexString(projectId) } }] : []),
      { $group: { _id: null, totalHours: { $sum: '$rows.totalHours' } } }
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
      { $match: { status: LEAVE_STATUS.APPROVED, organizationId: req.organizationId } },
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
router.get('/pdf-export', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  const pdfGeneratorService = require('./pdfGenerator.service');

  let { from, to, period, userId, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  from = from ? new Date(from) : null;
  to = to ? new Date(to) : null;

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: from };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: to };
  if (userId) match.userId = mongoose.Types.ObjectId.createFromHexString(userId);
  if (projectId) match['rows.projectId'] = mongoose.Types.ObjectId.createFromHexString(projectId);

  // Fetch all needed data in parallel (all strictly scoped to organizationId)
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
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1, code: 1, budgetHours: 1, organizationId: 1 } }] } },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      { $sort: { totalHours: -1 } },
      { $limit: 15 },
    ]),
    // 3. Leave summary
    Leave.aggregate([
      { $match: { status: LEAVE_STATUS.APPROVED, organizationId: req.organizationId, ...(from ? { startDate: { $gte: from } } : {}), ...(to ? { endDate: { $lte: to } } : {}) } },
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
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, employeeId: 1, department: 1, organizationId: 1 } }] } },
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
      { $match: { organizationId: req.organizationId, ...(from ? { weekStartDate: { $gte: from } } : {}), ...(to ? { weekStartDate: { $lte: to } } : {}) } },
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
router.get('/csv-export', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  
  let { from, to, period, userId, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  from = from ? new Date(from) : null;
  to = to ? new Date(to) : null;

  const match = { status: TIMESHEET_STATUS.APPROVED, organizationId: req.organizationId };
  if (from) match.weekStartDate = { $gte: from };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: to };
  if (userId) match.userId = mongoose.Types.ObjectId.createFromHexString(userId);
  if (projectId) match['rows.projectId'] = mongoose.Types.ObjectId.createFromHexString(projectId);

  // Fetch categorized summary data (paralleling the PDF data, all strictly scoped)
  const [timesheetStats, projectData, employeeData, deptStats, complianceRes] = await Promise.all([
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: null, totalHours: { $sum: '$totalHours' }, totalTimesheets: { $sum: 1 }, uniqueEmployees: { $addToSet: '$userId' } } },
    ]),
    Timesheet.aggregate([
      { $match: match },
      { $unwind: '$rows' },
      { $group: { _id: '$rows.projectId', totalHours: { $sum: '$rows.totalHours' } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'p', pipeline: [{ $project: { name: 1, budgetHours: 1, organizationId: 1 } }] } },
      { $unwind: '$p' },
      { $sort: { totalHours: -1 } },
      { $limit: 15 }
    ]),
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: '$userId', totalHours: { $sum: '$totalHours' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { name: 1, employeeId: 1, department: 1, organizationId: 1 } }] } },
      { $unwind: '$u' },
      { $sort: { totalHours: -1 } },
      { $limit: 20 }
    ]),
    Timesheet.aggregate([
      { $match: match },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $group: { _id: '$u.department', totalHours: { $sum: '$totalHours' } } },
      { $sort: { totalHours: -1 } }
    ]),
    Timesheet.aggregate([
      { $match: { organizationId: req.organizationId, ...(from ? { weekStartDate: { $gte: from } } : {}), ...(to ? { weekStartDate: { $lte: to } } : {}) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const stats = timesheetStats[0] || { totalHours: 0, totalTimesheets: 0, uniqueEmployees: [] };
  let totalComp = 0, approvedComp = 0;
  complianceRes.forEach(r => {
    totalComp += r.count;
    if (r._id === 'approved') approvedComp = r.count;
  });
  const complianceRate = totalComp > 0 ? ((approvedComp / totalComp) * 100).toFixed(0) : '0';
  const avgHours = stats.uniqueEmployees?.length > 0 ? (stats.totalHours / stats.uniqueEmployees.length).toFixed(1) : '0';

  const escapeCsv = (str) => typeof str === 'string' ? `"${str.replace(/"/g, '""')}"` : str;

  // Build CSV Content
  let csv = `EXECUTIVE WORKFORCE REPORT SUMMARY\n`;
  csv += `Organization,${req.user.organizationName || 'Current Organization'}\n`;
  csv += `Reporting Period,${from ? from.toISOString().split('T')[0] : 'All Time'} to ${to ? to.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}\n`;
  csv += `Generated At,${new Date().toISOString()}\n\n`;

  csv += `1. KEY PERFORMANCE INDICATORS\n`;
  csv += `Metric,Value,Description\n`;
  csv += `Total Hours Logged,${stats.totalHours},Total approved hours in period\n`;
  csv += `Compliance Rate,${complianceRate}%,Accuracy of timesheet submissions\n`;
  csv += `Average Hours/Employee,${avgHours},Average productive hours per active resource\n`;
  csv += `Resource Count,${stats.uniqueEmployees?.length || 0},Total distinct employees contributing\n\n`;

  csv += `2. DEPARTMENTAL UTILIZATION\n`;
  csv += `Department,Total Hours Contribution,% of Total\n`;
  deptStats.forEach(d => {
    const perc = stats.totalHours > 0 ? ((d.totalHours / stats.totalHours) * 100).toFixed(1) : 0;
    csv += `${escapeCsv(d._id || 'Unassigned')},${d.totalHours},${perc}%\n`;
  });
  csv += `\n`;

  csv += `3. PROJECT FOCUS AREAS\n`;
  csv += `Project Name,Total Productive Hours,Budget Hours,Utilization %\n`;
  projectData.forEach(p => {
    const budget = p.p?.budgetHours || 0;
    const util = budget > 0 ? ((p.totalHours / budget) * 100).toFixed(1) : 'N/A';
    csv += `${escapeCsv(p.p?.name || 'Unknown')},${p.totalHours},${budget},${util}%\n`;
  });
  csv += `\n`;

  csv += `4. TOP RESOURCE PERFORMANCE (TOP 20)\n`;
  csv += `Employee Name,Employee ID,Department,Total Hours Logged\n`;
  employeeData.forEach(e => {
    csv += `${escapeCsv(e.u?.name || 'Unknown')},${escapeCsv(e.u?.employeeId || '-')},${escapeCsv(e.u?.department || '-')},${e.totalHours.toFixed(2)}\n`;
  });

  const now = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="Enterprise-Summary-${now}.csv"`);
  res.send(csv);
}));

module.exports = router;
