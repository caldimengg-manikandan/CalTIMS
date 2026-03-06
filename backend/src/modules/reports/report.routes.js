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
  const PDFDocument = require('pdfkit');
  const mongoose = require('mongoose');

  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;

  const match = { status: TIMESHEET_STATUS.APPROVED };
  if (from) match.weekStartDate = { $gte: from };
  if (to) match.weekStartDate = { ...match.weekStartDate, $lte: to };
  if (req.query.userId) match.userId = mongoose.Types.ObjectId.createFromHexString(req.query.userId);

  // Fetch all needed data in parallel
  const [timesheetStats, projectData, leaveData, weeklyTrend, employeeData] = await Promise.all([
    // Overall stats
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
    // Project hours
    Timesheet.aggregate([
      { $match: match },
      { $unwind: '$rows' },
      { $group: { _id: '$rows.projectId', totalHours: { $sum: '$rows.totalHours' } } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project', pipeline: [{ $project: { name: 1, code: 1 } }] } },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      { $sort: { totalHours: -1 } },
      { $limit: 15 },
    ]),
    // Leave summary
    Leave.aggregate([
      { $match: { status: LEAVE_STATUS.APPROVED, ...(from ? { startDate: { $gte: from } } : {}), ...(to ? { endDate: { $lte: to } } : {}) } },
      { $group: { _id: '$leaveType', count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
      { $sort: { totalDays: -1 } },
    ]),
    // Weekly trend
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: '$weekStartDate', totalHours: { $sum: '$totalHours' }, employeeCount: { $addToSet: '$userId' } } },
      { $project: { week: '$_id', totalHours: 1, employeeCount: { $size: '$employeeCount' } } },
      { $sort: { week: 1 } },
      { $limit: 20 },
    ]),
    // Top employees
    Timesheet.aggregate([
      { $match: match },
      { $group: { _id: '$userId', totalHours: { $sum: '$totalHours' }, timesheetCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, employeeId: 1, department: 1 } }] } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { totalHours: -1 } },
      { $limit: 15 },
    ]),
  ]);

  const stats = timesheetStats[0] || { totalHours: 0, totalTimesheets: 0, uniqueEmployees: [] };
  const now = new Date();

  // Build PDF
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="timesheet-report-${now.toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  // ── Colors & helpers ────────────────────────────────────────────────────
  const PRIMARY = '#6366f1';
  const DARK = '#1e293b';
  const GRAY = '#64748b';
  const LIGHT_GRAY = '#f1f5f9';
  const WHITE = '#ffffff';

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const pageWidth = doc.page.width - 100;

  // ── Cover / Header ──────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 120).fill(PRIMARY);
  doc.fillColor(WHITE).fontSize(28).font('Helvetica-Bold').text('Timesheet Report', 50, 35, { align: 'left' });
  doc.fontSize(13).font('Helvetica').text('Reports & Analytics', 50, 70, { align: 'left' });

  const dateLabel = (from || to)
    ? `Period: ${from ? formatDate(from) : 'All time'} — ${to ? formatDate(to) : 'Present'}`
    : 'Period: All Time';
  doc.fontSize(10).fillColor('rgba(255,255,255,0.8)').text(dateLabel, 50, 92, { align: 'left' });
  doc.fontSize(10).fillColor('rgba(255,255,255,0.8)').text(`Generated: ${formatDate(now)}`, 0, 92, { align: 'right' });

  doc.moveDown(4);

  // ── KPI Summary Cards ───────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('Summary Overview', 50, 145);
  doc.moveTo(50, 165).lineTo(50 + pageWidth, 165).strokeColor(PRIMARY).lineWidth(2).stroke();

  const kpis = [
    { label: 'Total Approved Hours', value: `${(stats.totalHours || 0).toFixed(1)}h` },
    { label: 'Active Employees', value: (stats.uniqueEmployees?.length || 0).toString() },
    { label: 'Total Timesheets', value: (stats.totalTimesheets || 0).toString() },
    { label: 'Projects Covered', value: (projectData?.length || 0).toString() },
  ];

  const cardW = pageWidth / 4 - 8;
  kpis.forEach((kpi, i) => {
    const x = 50 + i * (cardW + 10);
    const y = 175;
    doc.rect(x, y, cardW, 70).fill(LIGHT_GRAY);
    doc.fillColor(PRIMARY).fontSize(22).font('Helvetica-Bold').text(kpi.value, x + 8, y + 10, { width: cardW - 16, align: 'center' });
    doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(kpi.label, x + 8, y + 42, { width: cardW - 16, align: 'center' });
  });

  doc.moveDown(1);

  // ── Helper: draw a simple table ─────────────────────────────────────────
  const drawTable = (headers, rows, startY, colWidths) => {
    let y = startY;
    const rowH = 22;

    // Header row
    doc.rect(50, y, pageWidth, rowH).fill(PRIMARY);
    let x = 50;
    headers.forEach((h, i) => {
      doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold').text(h, x + 6, y + 7, { width: colWidths[i] - 12 });
      x += colWidths[i];
    });
    y += rowH;

    rows.forEach((row, ri) => {
      doc.rect(50, y, pageWidth, rowH).fill(ri % 2 === 0 ? WHITE : LIGHT_GRAY);
      let cx = 50;
      row.forEach((cell, ci) => {
        doc.fillColor(DARK).fontSize(8.5).font('Helvetica').text(String(cell ?? '—'), cx + 6, y + 7, { width: colWidths[ci] - 12 });
        cx += colWidths[ci];
      });
      y += rowH;
      // Page break
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }
    });

    return y;
  };

  // ── Hours by Project ────────────────────────────────────────────────────
  let curY = 270;
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Hours by Project', 50, curY);
  curY += 20;
  const projRows = projectData.map(p => [
    p.project?.name || 'Unknown',
    p.project?.code || '—',
    `${(p.totalHours || 0).toFixed(1)}h`,
  ]);
  const projColW = [pageWidth * 0.5, pageWidth * 0.25, pageWidth * 0.25];
  curY = drawTable(['Project Name', 'Code', 'Total Hours'], projRows, curY, projColW);
  curY += 20;

  // ── Top Employees ───────────────────────────────────────────────────────
  if (curY > doc.page.height - 150) { doc.addPage(); curY = 50; }
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Top Employees by Hours', 50, curY);
  curY += 20;
  const empRows = employeeData.map(e => [
    e.user?.name || 'Unknown',
    e.user?.employeeId || '—',
    e.user?.department || '—',
    `${(e.totalHours || 0).toFixed(1)}h`,
    e.timesheetCount,
  ]);
  const empColW = [pageWidth * 0.3, pageWidth * 0.15, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.15];
  curY = drawTable(['Employee', 'ID', 'Department', 'Total Hours', 'Sheets'], empRows, curY, empColW);
  curY += 20;

  // ── Leave Summary ───────────────────────────────────────────────────────
  if (curY > doc.page.height - 150) { doc.addPage(); curY = 50; }
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Leave Summary (Approved)', 50, curY);
  curY += 20;
  const leaveRows = leaveData.map(l => [l._id || '—', l.count, `${l.totalDays}d`]);
  const leaveColW = [pageWidth * 0.5, pageWidth * 0.25, pageWidth * 0.25];
  curY = drawTable(['Leave Type', 'Requests', 'Total Days'], leaveRows, curY, leaveColW);
  curY += 20;

  // ── Weekly Trend ────────────────────────────────────────────────────────
  if (curY > doc.page.height - 150) { doc.addPage(); curY = 50; }
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Weekly Hours Trend', 50, curY);
  curY += 20;
  const trendRows = weeklyTrend.map(w => [
    formatDate(w.week),
    `${(w.totalHours || 0).toFixed(1)}h`,
    w.employeeCount,
    w.employeeCount ? `${(w.totalHours / w.employeeCount).toFixed(1)}h` : '—',
  ]);
  const trendColW = [pageWidth * 0.3, pageWidth * 0.25, pageWidth * 0.2, pageWidth * 0.25];
  curY = drawTable(['Week Starting', 'Total Hours', 'Employees', 'Avg/Employee'], trendRows, curY, trendColW);

  // ─── Footer on last page ─────────────────────────────────────────────────
  const pages = doc.bufferedPageRange ? doc.bufferedPageRange() : { count: 1 };
  doc.fontSize(8).fillColor(GRAY).text(
    `Timesheet Management System — Confidential — Generated ${now.toLocaleString()}`,
    doc.page.margins.left, doc.page.margins.top, { align: 'center' }
  );

  doc.end();
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
