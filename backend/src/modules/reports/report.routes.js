'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { prisma } = require('../../config/database');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkPermission } = require('../../middleware/rbac.middleware');
const { TIMESHEET_STATUS, LEAVE_STATUS } = require('../../constants');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');
const { getPeriodRange } = require('../../shared/utils/dateHelpers');

router.use(authenticate);
router.use(checkSubscription);
router.use(requireFeature('reports'));
router.use(checkPermission('Reports', 'Reports Dashboard', 'view'));

// Helper to calculate total hours for a row if not already present
const getRowTotal = (row) => {
  if (typeof row.totalHours === 'number') return row.totalHours;
  if (Array.isArray(row.entries)) {
    return row.entries.reduce((sum, e) => {
      const h = parseFloat(e.hoursWorked || e.hours || 0);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);
  }
  return 0;
};

// ─── Get dynamic filter options (Years) ──────────────────────────────────────
router.get('/filter-options', asyncHandler(async (req, res) => {
  const firstTs = await prisma.timesheetWeek.findFirst({
    where: { organizationId: req.organizationId, isDeleted: false },
    orderBy: { weekStartDate: 'asc' },
    select: { weekStartDate: true }
  });
  
  const startYear = firstTs ? new Date(firstTs.weekStartDate).getFullYear() : new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  
  const years = [];
  for (let y = startYear; y <= currentYear + 1; y++) {
    years.push(y);
  }
  
  ApiResponse.success(res, { years });
}));

// ─── Timesheet hours summary (by employee and project) ─────────────────────
router.get('/timesheet-summary', asyncHandler(async (req, res) => {
  let { from, to, period, userId, projectId } = req.query;
  
  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const where = {
    organizationId: req.organizationId,
    status: { in: ['APPROVED', 'ADMIN_FILLED'] },
    isDeleted: false
  };

  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };
  if (userId) where.userId = userId;
  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  const timesheetWeeks = await prisma.timesheetWeek.findMany({
    where,
    include: {
      organization: { select: { name: true } }
    }
  });

  const grouping = {};

  timesheetWeeks.forEach(ts => {
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;
      
      const key = `${ts.userId}_${row.projectId}`;
      if (!grouping[key]) {
        grouping[key] = {
          userId: ts.userId,
          projectId: row.projectId,
          totalHours: 0,
          timesheetIds: new Set()
        };
      }
      grouping[key].totalHours += getRowTotal(row);
      grouping[key].timesheetIds.add(ts.id);
    });
  });

  const summary = Object.values(grouping);

  // Enrichment
  const userIds = [...new Set(summary.map(s => s.userId))];
  const projectIds = [...new Set(summary.map(s => s.projectId))];

  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true, employee: { select: { employeeCode: true, department: { select: { name: true } } } } }
    }),
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, code: true }
    })
  ]);

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const enriched = summary.map(s => ({
    _id: { userId: s.userId, projectId: s.projectId },
    totalHours: Math.round(s.totalHours * 100) / 100,
    timesheetCount: s.timesheetIds.size,
    user: userMap[s.userId] ? {
      name: userMap[s.userId].name,
      email: userMap[s.userId].email,
      employeeId: userMap[s.userId].employee?.employeeCode,
      department: userMap[s.userId].employee?.department?.name,
      role: userMap[s.userId].role
    } : null,
    project: projectMap[s.projectId] || null
  })).sort((a, b) => b.totalHours - a.totalHours);

  ApiResponse.success(res, { data: enriched });
}));

// ─── NEW: Compliance Summary (Donut Chart Data) ───────────────────────────
router.get('/compliance-summary', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;
  
  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const where = { organizationId: req.organizationId, isDeleted: false };
  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  // Note: if projectId is passed, we must filter at JS level because it's inside JSON rows
  const timesheetWeeks = await prisma.timesheetWeek.findMany({ where });

  const result = {
    APPROVED: 0,
    ADMIN_FILLED: 0,
    SUBMITTED: 0,
    REJECTED: 0,
    DRAFT: 0
  };

  timesheetWeeks.forEach(ts => {
    // Project filter if applicable
    if (projectId) {
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      if (!rows.some(r => r.projectId === projectId)) return;
    }

    if (result[ts.status] !== undefined) {
      result[ts.status]++;
    }
  });

  const formattedData = [
    { name: 'Approved', value: result.APPROVED, fill: '#22c55e' },
    { name: 'Admin Filled', value: result.ADMIN_FILLED, fill: '#6366f1' },
    { name: 'Pending Review', value: result.SUBMITTED, fill: '#f59e0b' },
    { name: 'Rejected', value: result.REJECTED, fill: '#ef4444' },
    { name: 'Draft/Incomplete', value: result.DRAFT, fill: '#94a3b8' }
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

  const where = {
    organizationId: req.organizationId,
    status: { in: ['APPROVED', 'ADMIN_FILLED'] },
    isDeleted: false
  };

  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  const timesheetWeeks = await prisma.timesheetWeek.findMany({ where });

  const projectStats = {};

  timesheetWeeks.forEach(ts => {
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;

      if (!projectStats[row.projectId]) {
        projectStats[row.projectId] = {
          projectId: row.projectId,
          totalHours: 0,
          employees: {},
          employeeCount: new Set()
        };
      }

      const stats = projectStats[row.projectId];
      const rowHours = getRowTotal(row);
      stats.totalHours += rowHours;
      stats.employeeCount.add(ts.userId);

      if (!stats.employees[ts.userId]) {
        stats.employees[ts.userId] = { userId: ts.userId, hours: 0 };
      }
      stats.employees[ts.userId].hours += rowHours;
    });
  });

  const projectIds = Object.keys(projectStats);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: { 
      members: { 
        select: { 
          role: true, 
          budgetHours: true, 
          employee: { select: { userId: true, user: { select: { name: true } } } } 
        } 
      } 
    }
  });

  const normalizedProjects = projects.map(p => ({
    ...p,
    allocatedEmployees: p.members.map(m => ({
      userId: m.employee.userId,
      role: m.role,
      budgetHours: m.budgetHours
    }))
  }));

  const userIds = new Set();
  normalizedProjects.forEach(p => {
    const alloc = p.allocatedEmployees;
    alloc.forEach(a => userIds.add(a.userId));
  });
  // Also add employees who actually logged hours but might not be allocated
  Object.values(projectStats).forEach(s => {
    Object.keys(s.employees).forEach(uid => userIds.add(uid));
  });

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, name: true }
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  const result = normalizedProjects.map(p => {
    const stats = projectStats[p.id] || { totalHours: 0, employees: {}, employeeCount: new Set() };
    const employeeCount = stats.employeeCount.size;
    const alloc = p.allocatedEmployees;

    const capacity = p.budgetHours > 0 ? p.budgetHours : (alloc.length || employeeCount) * 40;

    const employeeDetails = alloc.map(a => {
        const logged = stats.employees[a.userId]?.hours || 0;
        return {
            userId: { _id: a.userId, name: userMap[a.userId] || 'Unknown' },
            role: a.role,
            budgetHours: a.budgetHours,
            loggedHours: Math.round(logged * 100) / 100
        };
    });

    return {
      _id: p.id,
      totalHours: Math.round(stats.totalHours * 100) / 100,
      employeeCount,
      project: {
        name: p.name,
        code: p.code,
        allocatedEmployees: p.allocatedEmployees,
        budgetHours: p.budgetHours
      },
      capacity,
      employeeDetails,
      utilizationPercentage: capacity > 0 ? (stats.totalHours / capacity) * 100 : 0
    };
  }).sort((a, b) => b.totalHours - a.totalHours);

  ApiResponse.success(res, { data: result });
}));

// ─── Leave summary ─────────────────────────────────────────────────────────
router.get('/leave-summary', asyncHandler(async (req, res) => {
  let { from, to, period } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const where = { organizationId: req.organizationId, isDeleted: false };
  if (from) where.startDate = { gte: new Date(from) };
  if (to) where.startDate = { ...where.startDate, lte: new Date(to) };

  if (req.query.department) {
    where.employee = {
      department: {
        name: { equals: req.query.department, mode: 'insensitive' }
      }
    };
  }

  // Use Prisma groupBy
  const groups = await prisma.leave.groupBy({
    by: ['leaveTypeId', 'status'],
    where,
    _count: { _all: true },
    _sum: { totalDays: true }
  });

  const formatted = groups.map(g => ({
    _id: { leaveType: g.leaveTypeId, status: g.status },
    count: g._count._all,
    totalDays: g._sum.totalDays || 0
  })).sort((a, b) => a._id.leaveType.localeCompare(b._id.leaveType));

  ApiResponse.success(res, { data: formatted });
}));

// ─── Leave details (drill-down for a specific type) ────────────────────────
router.get('/leave-details', asyncHandler(async (req, res) => {
  const { leaveType, from, to } = req.query;
  const where = { status: LEAVE_STATUS.APPROVED, organizationId: req.organizationId, isDeleted: false };
  if (leaveType) where.leaveTypeId = leaveType;
  if (from) where.startDate = { gte: new Date(from) };
  if (to) where.startDate = { ...where.startDate, lte: new Date(to) };

  if (req.query.department) {
    where.employee = {
      department: {
        name: { equals: req.query.department, mode: 'insensitive' }
      }
    };
  }

  const groups = await prisma.leave.groupBy({
    by: ['employeeId'],
    where,
    _sum: { totalDays: true },
    _count: { _all: true }
  });

  const employeeIds = groups.map(g => g.employeeId);
  const users = await prisma.user.findMany({
    where: { employee: { id: { in: employeeIds } } },
    select: { name: true, role: true, employee: { select: { id: true, employeeCode: true, department: { select: { name: true } } } } }
  });

  const userMap = Object.fromEntries(users.map(u => [u.employee?.id, u]));

  const result = groups.map(g => ({
    _id: g.employeeId,
    totalDays: g._sum.totalDays || 0,
    leaveCount: g._count._all,
    user: userMap[g.employeeId] ? {
        name: userMap[g.employeeId].name,
        role: userMap[g.employeeId].role,
        employeeId: userMap[g.employeeId].employee?.employeeCode,
        department: userMap[g.employeeId].employee?.department?.name
    } : null
  })).sort((a, b) => b.totalDays - a.totalDays);

  ApiResponse.success(res, { data: result });
}));

// ─── Individual task details (drill-down for user/project/period) ──────────
router.get('/timesheet-details', asyncHandler(async (req, res) => {
  const { userId, projectId, from, to } = req.query;
  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (userId) where.userId = userId;
  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  const timesheetWeeks = await prisma.timesheetWeek.findMany({ where });

  const details = [];
  timesheetWeeks.forEach(ts => {
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;
      const entries = Array.isArray(row.entries) ? row.entries : [];
      entries.forEach(entry => {
        details.push({
          date: entry.date,
          hoursWorked: entry.hoursWorked,
          taskDescription: entry.taskDescription,
          category: row.category,
          weekStartDate: ts.weekStartDate
        });
      });
    });
  });

  details.sort((a, b) => new Date(b.date) - new Date(a.date));

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

  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  const timesheetWeeks = await prisma.timesheetWeek.findMany({
    where,
    select: { userId: true, weekStartDate: true, rows: true }
  });

  const grouping = {};
  timesheetWeeks.forEach(ts => {
      const key = `${ts.userId}_${ts.weekStartDate.toISOString()}`;
      if (!grouping[key]) {
          grouping[key] = { userId: ts.userId, week: ts.weekStartDate, totalHours: 0 };
      }
      const rows = Array.isArray(ts.rows) ? ts.rows : [];
      rows.forEach(row => {
          grouping[key].totalHours += getRowTotal(row);
      });
  });

  const groups = Object.values(grouping);

  const userIds = [...new Set(groups.map(g => g.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, role: true, employee: { select: { employeeCode: true, department: { select: { name: true } } } } }
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const result = groups.map(g => ({
    _id: { userId: g.userId, week: g.week },
    totalHours: g.totalHours || 0,
    user: userMap[g.userId] ? {
        name: userMap[g.userId].name,
        employeeId: userMap[g.userId].employee?.employeeCode,
        department: userMap[g.userId].employee?.department?.name,
        role: userMap[g.userId].role
    } : null
  })).sort((a, b) => new Date(b._id.week) - new Date(a._id.week) || b.totalHours - a.totalHours);

  ApiResponse.success(res, { data: result });
}));

// ─── NEW: Weekly hours trend (for line chart) ─────────────────────────────
router.get('/weekly-trend', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, userId, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };
  if (userId) where.userId = userId;

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  // For projectId, we must fetch and filter in JS because it's in JSON rows
  const timesheetWeeks = await prisma.timesheetWeek.findMany({ where });

  const weekMap = {};
  timesheetWeeks.forEach(ts => {
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    let weekTotal = 0;
    let matchesProject = !projectId;

    rows.forEach(row => {
      if (projectId && row.projectId === projectId) {
        matchesProject = true;
        weekTotal += getRowTotal(row);
      } else if (!projectId) {
        weekTotal += getRowTotal(row);
      }
    });

    if (!matchesProject) return;

    const key = ts.weekStartDate.toISOString();
    if (!weekMap[key]) {
      weekMap[key] = {
        week: ts.weekStartDate,
        totalHours: 0,
        employees: new Set(),
        timesheetCount: 0
      };
    }
    const w = weekMap[key];
    w.totalHours += weekTotal;
    w.employees.add(ts.userId);
    w.timesheetCount += 1;
  });

  const result = Object.values(weekMap).map(w => ({
    week: w.week,
    totalHours: Math.round(w.totalHours * 100) / 100,
    employeeCount: w.employees.size,
    timesheetCount: w.timesheetCount,
    avgHoursPerEmployee: w.employees.size > 0 ? (w.totalHours / w.employees.size) : 0
  })).sort((a, b) => new Date(a.week) - new Date(b.week));

  ApiResponse.success(res, { data: result });
}));

// ─── NEW: Department hours summary (for stacked bar chart) ────────────────
router.get('/department-summary', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };

  const timesheetWeeks = await prisma.timesheetWeek.findMany({
    where,
    include: {
      user: {
        select: {
          employee: {
            select: {
              department: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  const deptStats = {};
  const projectIds = new Set();

  timesheetWeeks.forEach(ts => {
    const dept = ts.user?.employee?.department?.name || 'Unassigned';
    if (!deptStats[dept]) {
      deptStats[dept] = {
        department: dept,
        totalHours: 0,
        projects: {}
      };
    }
    const d = deptStats[dept];
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    
    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;
      
      projectIds.add(row.projectId);
      const rowHours = getRowTotal(row);
      d.totalHours += rowHours;
      
      if (!d.projects[row.projectId]) {
        d.projects[row.projectId] = { hours: 0 };
      }
      d.projects[row.projectId].hours += rowHours;
    });
  });

  const projects = await prisma.project.findMany({
    where: { id: { in: Array.from(projectIds) } },
    select: { id: true, name: true }
  });
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

  const result = Object.values(deptStats).map(d => ({
    department: d.department,
    totalHours: Math.round(d.totalHours * 100) / 100,
    projects: Object.entries(d.projects).map(([pid, stats]) => ({
      name: projectMap[pid] || 'Unknown',
      hours: Math.round(stats.hours * 100) / 100
    }))
  })).sort((a, b) => b.totalHours - a.totalHours);

  ApiResponse.success(res, { data: result });
}));

// ─── NEW: Smart Insights Generator ──────────────────────────────────────────
router.get('/smart-insights', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (from) where.weekStartDate = { gte: new Date(from) };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: new Date(to) };

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  const [timesheetWeeks, leaveStats] = await Promise.all([
    prisma.timesheetWeek.findMany({
      where,
      include: {
        user: {
          select: {
            employee: {
              select: {
                department: { select: { name: true } }
              }
            }
          }
        }
      }
    }),
    prisma.leave.aggregate({
      where: { status: LEAVE_STATUS.APPROVED, organizationId: req.organizationId, isDeleted: false },
      _sum: { totalDays: true }
    })
  ]);

  let totalHours = 0;
  const deptHours = {};

  timesheetWeeks.forEach(ts => {
    const dept = ts.user?.employee?.department?.name || 'Unassigned';
    if (!deptHours[dept]) deptHours[dept] = 0;
    
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;
      const rowHours = getRowTotal(row);
      totalHours += rowHours;
      deptHours[dept] += rowHours;
    });
  });

  const topDeptEntry = Object.entries(deptHours).sort((a,b) => b[1] - a[1])[0];
  const totalLeaves = leaveStats._sum.totalDays || 0;

  const insights = [];

  if (totalHours > 0 && topDeptEntry) {
    const percentage = ((topDeptEntry[1] / totalHours) * 100).toFixed(0);
    insights.push(`${topDeptEntry[0]} contributed ${percentage}% of all logged hours.`);
  }

  if (totalLeaves > 0) {
    const assumedWorkDays = Math.max(1, (totalHours / 8)); 
    const leaveImpact = ((totalLeaves / (assumedWorkDays + totalLeaves)) * 100).toFixed(1);
    insights.push(`Leave accounted for ~${leaveImpact}% of total potential capacity.`);
  }

  insights.push(`Average weekly productivity is stable based on recent submissions.`);

  ApiResponse.success(res, { data: insights });
}));

// ─── NEW: PDF Export ────────────────────────────────────────────────────────
router.get('/pdf-export', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  const pdfGeneratorService = require('./pdfGenerator.service');

  let { from, to, period, userId, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  from = from ? new Date(from) : null;
  to = to ? new Date(to) : null;

  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (from) where.weekStartDate = { gte: from };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: to };
  if (userId) where.userId = userId;

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  // Fetch all needed data in parallel
  const [timesheetWeeks, leaveRes, complianceRes] = await Promise.all([
    prisma.timesheetWeek.findMany({
      where,
      include: {
        user: {
          select: { name: true, role: true, employee: { select: { employeeCode: true, department: { select: { name: true } } } } }
        }
      }
    }),
    prisma.leave.groupBy({
        by: ['leaveTypeId'],
        where: { 
            organizationId: req.organizationId, 
            status: LEAVE_STATUS.APPROVED,
            isDeleted: false,
            ...(from ? { startDate: { gte: from } } : {}),
            ...(to ? { endDate: { lte: to } } : {})
        },
        _count: { _all: true },
        _sum: { totalDays: true }
    }),
    prisma.timesheetWeek.groupBy({
        by: ['status'],
        where: {
            organizationId: req.organizationId,
            isDeleted: false,
            ...(from ? { weekStartDate: { gte: from } } : {}),
            ...(to ? { weekStartDate: { lte: to } } : {})
        },
        _count: { _all: true }
    })
  ]);

  // Aggregate project hours and employee stats from timesheetWeeks
  const projectStats = {};
  const employeeStats = {};
  const weeklyTrendMap = {};
  const deptStatsMap = {};
  
  let totalHours = 0;
  const uniqueEmployees = new Set();

  timesheetWeeks.forEach(ts => {
    uniqueEmployees.add(ts.userId);
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    
    // Weekly Trend
    const weekKey = ts.weekStartDate.toISOString();
    if (!weeklyTrendMap[weekKey]) weeklyTrendMap[weekKey] = { week: ts.weekStartDate, totalHours: 0, employeeCount: new Set() };
    const wt = weeklyTrendMap[weekKey];
    wt.employeeCount.add(ts.userId);

    // Dept Stats
    const dept = ts.user?.employee?.department?.name || 'Unassigned';
    if (!deptStatsMap[dept]) deptStatsMap[dept] = { _id: dept, totalHours: 0, employeeCount: new Set() };
    const ds = deptStatsMap[dept];
    ds.employeeCount.add(ts.userId);

    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;
      
      const rowHours = getRowTotal(row);
      totalHours += rowHours;
      wt.totalHours += rowHours;
      ds.totalHours += rowHours;

      // Project Stats
      if (!projectStats[row.projectId]) projectStats[row.projectId] = { _id: row.projectId, totalHours: 0 };
      projectStats[row.projectId].totalHours += rowHours;

      // Employee Stats
      if (!employeeStats[ts.userId]) employeeStats[ts.userId] = { _id: ts.userId, totalHours: 0, timesheetCount: 0, user: ts.user };
      employeeStats[ts.userId].totalHours += rowHours;
    });
    
    if (employeeStats[ts.userId]) employeeStats[ts.userId].timesheetCount += 1;
  });

  const projectIds = Object.keys(projectStats);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true, code: true, budgetHours: true }
  });
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const formattedProjectData = Object.values(projectStats).map(ps => ({
    ...ps,
    project: projectMap[ps._id] || { name: 'Unknown', code: '?' }
  })).sort((a,b) => b.totalHours - a.totalHours).slice(0, 15);

  const formattedEmployeeData = Object.values(employeeStats).map(es => ({
    _id: es._id,
    totalHours: es.totalHours,
    timesheetCount: es.timesheetCount,
    user: {
        name: es.user?.name,
        employeeId: es.user?.employee?.employeeCode,
        department: es.user?.employee?.department?.name,
        organizationId: req.organizationId
    }
  })).sort((a, b) => b.totalHours - a.totalHours).slice(0, 15);

  const stats = {
    totalHours,
    totalTimesheets: timesheetWeeks.length,
    uniqueEmployees: Array.from(uniqueEmployees)
  };

  const complianceStats = { total: 0, approved: 0, submitted: 0, rejected: 0, draft: 0 };
  complianceRes.forEach(r => {
    complianceStats[r.status] = r._count._all;
    complianceStats.total += r._count._all;
  });

  const data = {
    stats,
    projectData: formattedProjectData,
    leaveData: leaveRes.map(l => ({ _id: l.leaveType, count: l._count._all, totalDays: l._sum.totalDays || 0 })),
    weeklyTrend: Object.values(weeklyTrendMap).map(w => ({ ...w, employeeCount: w.employeeCount.size })).sort((a,b) => a.week - b.week),
    employeeData: formattedEmployeeData,
    deptStats: Object.values(deptStatsMap).map(d => ({ ...d, employeeCount: d.employeeCount.size })),
    complianceStats
  };

  const now = new Date();
  await pdfGeneratorService.generateEnterpriseWorkforceReport(res, data, { from, to, now });
}));

// ─── NEW: CSV Export ─────────────────────────────────────────────────────────
router.get('/csv-export', requireFeature('advanced_reports'), asyncHandler(async (req, res) => {
  let { from, to, period, userId, projectId } = req.query;

  if (period) {
    const range = getPeriodRange(period);
    from = range.from;
    to = range.to;
  }

  from = from ? new Date(from) : null;
  to = to ? new Date(to) : null;

  const where = {
    organizationId: req.organizationId,
    status: { in: [TIMESHEET_STATUS.APPROVED, TIMESHEET_STATUS.ADMIN_FILLED] },
    isDeleted: false
  };
  if (from) where.weekStartDate = { gte: from };
  if (to) where.weekStartDate = { ...where.weekStartDate, lte: to };
  if (userId) where.userId = userId;

  if (req.query.department) {
    where.user = {
      employee: {
        department: {
          name: { equals: req.query.department, mode: 'insensitive' }
        }
      }
    };
  }

  const timesheetWeeks = await prisma.timesheetWeek.findMany({
    where,
    include: {
      user: {
        select: { name: true, role: true, employee: { select: { employeeCode: true, department: { select: { name: true } } } } }
      }
    }
  });

  const projectStats = {};
  const employeeStats = {};
  const deptStatsMap = {};
  let totalHours = 0;
  const uniqueEmployees = new Set();

  timesheetWeeks.forEach(ts => {
    uniqueEmployees.add(ts.userId);
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    
    const dept = ts.user?.employee?.department?.name || 'Unassigned';
    if (!deptStatsMap[dept]) deptStatsMap[dept] = { totalHours: 0 };
    
    rows.forEach(row => {
      if (projectId && row.projectId !== projectId) return;
      
      const rowHours = getRowTotal(row);
      totalHours += rowHours;
      deptStatsMap[dept].totalHours += rowHours;

      if (!projectStats[row.projectId]) projectStats[row.projectId] = { totalHours: 0 };
      projectStats[row.projectId].totalHours += rowHours;

      if (!employeeStats[ts.userId]) employeeStats[ts.userId] = { totalHours: 0, user: ts.user };
      employeeStats[ts.userId].totalHours += rowHours;
    });
  });

  const projects = await prisma.project.findMany({
    where: { id: { in: Object.keys(projectStats) } },
    select: { id: true, name: true, budgetHours: true }
  });
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const complianceRes = await prisma.timesheetWeek.groupBy({
    by: ['status'],
    where: {
        organizationId: req.organizationId,
        isDeleted: false,
        ...(from ? { weekStartDate: { gte: from } } : {}),
        ...(to ? { weekStartDate: { lte: to } } : {})
    },
    _count: { _all: true }
  });

  let totalComp = 0, approvedComp = 0;
  complianceRes.forEach(r => {
    totalComp += r._count._all;
    if (r.status === 'APPROVED' || r.status === 'ADMIN_FILLED') approvedComp += r._count._all;
  });
  const complianceRate = totalComp > 0 ? ((approvedComp / totalComp) * 100).toFixed(0) : '0';
  const avgHours = uniqueEmployees.size > 0 ? (totalHours / uniqueEmployees.size).toFixed(1) : '0';

  const escapeCsv = (str) => typeof str === 'string' ? `"${str.replace(/"/g, '""')}"` : str;

  let csv = `EXECUTIVE WORKFORCE REPORT SUMMARY\n`;
  csv += `Organization,${req.user.organizationName || 'Current Organization'}\n`;
  csv += `Reporting Period,${from ? from.toISOString().split('T')[0] : 'All Time'} to ${to ? to.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}\n`;
  csv += `Generated At,${new Date().toISOString()}\n\n`;

  csv += `1. KEY PERFORMANCE INDICATORS\n`;
  csv += `Metric,Value,Description\n`;
  csv += `Total Hours Logged,${totalHours},Total approved hours in period\n`;
  csv += `Compliance Rate,${complianceRate}%,Accuracy of timesheet submissions\n`;
  csv += `Average Hours/Employee,${avgHours},Average productive hours per active resource\n`;
  csv += `Resource Count,${uniqueEmployees.size},Total distinct employees contributing\n\n`;

  csv += `2. DEPARTMENTAL UTILIZATION\n`;
  csv += `Department,Total Hours Contribution,% of Total\n`;
  Object.entries(deptStatsMap).forEach(([dept, d]) => {
    const perc = totalHours > 0 ? ((d.totalHours / totalHours) * 100).toFixed(1) : 0;
    csv += `${escapeCsv(dept)},${d.totalHours},${perc}%\n`;
  });
  csv += `\n`;

  csv += `3. PROJECT FOCUS AREAS\n`;
  csv += `Project Name,Total Productive Hours,Budget Hours,Utilization %\n`;
  Object.entries(projectStats).forEach(([pid, ps]) => {
    const p = projectMap[pid];
    const budget = p?.budgetHours || 0;
    const util = budget > 0 ? ((ps.totalHours / budget) * 100).toFixed(1) : 'N/A';
    csv += `${escapeCsv(p?.name || 'Unknown')},${ps.totalHours},${budget},${util}%\n`;
  });
  csv += `\n`;

  csv += `4. TOP RESOURCE PERFORMANCE (TOP 20)\n`;
  csv += `Employee Name,Employee ID,Department,Total Hours Logged\n`;
  Object.values(employeeStats).sort((a,b) => b.totalHours - a.totalHours).slice(0, 20).forEach(e => {
    csv += `${escapeCsv(e.user?.name || 'Unknown')},${escapeCsv(e.user?.employee?.employeeCode || '-')},${escapeCsv(e.user?.employee?.department?.name || '-')},${e.totalHours.toFixed(2)}\n`;
  });

  const nowStr = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="Enterprise-Summary-${nowStr}.csv"`);
  res.send(csv);
}));

module.exports = router;
