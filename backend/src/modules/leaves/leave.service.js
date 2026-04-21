const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { ROLES } = require('../../constants');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { getWeekStart, getWeekEnd } = require('../../shared/utils/dateHelpers');
const policyService = require('../policyEngine/policy.service');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const notificationService = require('../notifications/notification.service');
const { format } = require('date-fns');
const { hasPermission } = require('../../shared/utils/rbac');

async function getWorkingDaysBetween(startDate, endDate, organizationId) {
  const policy = await policyService.getPolicy(organizationId).catch(() => null);
  const workWeek = policy?.attendance?.workWeek || 'Mon-Fri';
  const days = [];
  const cur = new Date(startDate);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);
  while (cur <= end) {
    const day = cur.getUTCDay();
    let isWorkingDay = workWeek === 'Sun-Thu' ? !(day === 5 || day === 6) : !(day === 0 || day === 6);
    if (isWorkingDay) days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

async function getWeekStartDay(organizationId) {
  const policy = await policyService.getPolicy(organizationId).catch(() => null);
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

async function getOrCreateLeaveProject(managerId, organizationId, tx = prisma) {
  const code = 'LEAVE-SYS';
  let lp = await tx.project.findFirst({ 
    where: { code, organizationId, isDeleted: false } 
  });
  if (!lp) {
    lp = await tx.project.create({
      data: { 
        name: 'Leave', 
        code, 
        description: 'System project for approved leave entries', 
        startDate: new Date('2020-01-01'), 
        status: 'ACTIVE', 
        organizationId, 
        managerId,
        type: 'leave',
        isSystemType: true
      },
    });
  }
  return lp;
}

async function removeLeaveTimesheets(leave, organizationId, tx = prisma) {
  const leaveProject = await tx.project.findFirst({ 
    where: { code: 'LEAVE-SYS', organizationId, isDeleted: false } 
  });
  if (!leaveProject) return;

  const employee = await tx.employee.findUnique({ 
    where: { id_organizationId: { id: leave.employeeId, organizationId } },
    include: { user: true } 
  });
  if (!employee) return;

  const workingDays = await getWorkingDaysBetween(leave.startDate, leave.endDate, organizationId);
  const wsd = await getWeekStartDay(organizationId);
  const weeks = groupByWeek(workingDays, wsd);
  const typeName = leave.type?.name || 'Leave';

  for (const { weekStart } of weeks) {
    const ts = await tx.timesheetWeek.findFirst({ 
      where: { 
        userId: employee.userId, 
        weekStartDate: weekStart, 
        organizationId,
        isDeleted: false
      } 
    });
    if (!ts) continue;
    let rows = Array.isArray(ts.rows) ? ts.rows : [];
    rows = rows.filter(r => !(r.projectId === leaveProject.id && r.category?.toLowerCase() === typeName.toLowerCase()));
    
    await tx.timesheetWeek.update({ 
      where: { id_organizationId: { id: ts.id, organizationId } }, 
      data: { rows } 
    });
  }
}

async function createLeaveTimesheets(leave, approverId, organizationId, tx = prisma) {
  const leaveProject = await getOrCreateLeaveProject(approverId, organizationId, tx);
  const employee = await tx.employee.findUnique({ 
    where: { id_organizationId: { id: leave.employeeId, organizationId } },
    include: { user: true } 
  });
  if (!employee) return;

  const workingDays = await getWorkingDaysBetween(leave.startDate, leave.endDate, organizationId);
  if (!workingDays.length) return;

  const wsd = await getWeekStartDay(organizationId);
  const weeks = groupByWeek(workingDays, wsd);
  const policy = await policyService.getPolicy(organizationId).catch(() => null);
  const fullHours = policy?.attendance?.workingHoursPerDay || 8;
  const halfHours = fullHours / 2;

  const typeName = leave.type?.name || 'Leave';
  const isLOP = typeName.toLowerCase().includes('loss of pay') || typeName.toLowerCase() === 'lop' || typeName.toLowerCase().includes('unpaid');
  const hoursPerDay = isLOP ? 0 : (leave.isHalfDay ? halfHours : fullHours);

  for (const { weekStart, weekEnd, dates } of weeks) {
    const entries = dates.map(date => ({ 
      date, 
      hoursWorked: hoursPerDay, 
      taskDescription: `${typeName} Leave`, 
      isLeave: true 
    }));
    
    let ts = await tx.timesheetWeek.findFirst({ 
      where: { 
        userId: employee.userId, 
        weekStartDate: weekStart, 
        organizationId,
        isDeleted: false
      } 
    });
    
    if (!ts) {
      ts = await tx.timesheetWeek.create({ 
        data: { 
          userId: employee.userId, 
          organizationId, 
          weekStartDate: weekStart, 
          weekEndDate: weekEnd, 
          status: 'DRAFT', 
          rows: [] 
        } 
      });
    }
    
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    rows.push({ projectId: leaveProject.id, projectName: 'Leave', category: typeName, entries });
    
    await tx.timesheetWeek.update({ 
      where: { id_organizationId: { id: ts.id, organizationId } }, 
      data: { rows } 
    });
  }
}

const leaveService = {
  async getAll(query, context) {
    const { organizationId, userId, role } = context;
    const { page, limit, skip } = parsePagination(query);
    
    // Base scoping using helper
    const baseQuery = enforceOrg({}, organizationId);
    const where = baseQuery.where;

    const canManageLeaves = hasPermission(context.permissions, 'Leave Management', 'Leave Requests', 'view');

    if (query.userId) {
       const emp = await prisma.employee.findUnique({ 
         where: { userId: query.userId } 
       });
       if (emp) where.employeeId = emp.id;
    } else if (!query.isAdminView && !canManageLeaves && !context.isSuperAdmin && !context.isOwner) {
       const emp = await prisma.employee.findUnique({ 
         where: { userId } 
       });
       if (emp) where.employeeId = emp.id;
    }

    if (query.status) where.status = query.status;
    if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
    
    // Add leaveType support since frontend might send 'leaveType'
    if (query.leaveType) {
      // It might be an ID or a string/name. Check if UUID
      if (query.leaveType.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
        where.leaveTypeId = query.leaveType;
      } else {
        where.type = { name: { contains: query.leaveType, mode: 'insensitive' } };
      }
    }

    if (query.leaveId) {
      where.leaveId = { contains: query.leaveId, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { leaveId: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
        { 
          employee: {
            user: {
              name: { contains: query.search, mode: 'insensitive' }
            }
          }
        },
        {
          employee: {
            employeeCode: { contains: query.search, mode: 'insensitive' } 
          }
        },
        {
          type: {
             name: { contains: query.search, mode: 'insensitive' } 
          }
        }
      ];
    }

    const [total, leaves] = await Promise.all([
      prisma.leave.count({ where }),
      prisma.leave.findMany({
        where,
        include: { 
          employee: { 
            include: { 
              user: { select: { id: true, name: true, email: true } } 
            } 
          }, 
          processedBy: {
            include: { user: { select: { id: true, name: true } } }
          },
          type: true 
        },
        orderBy: [
          { status: 'desc' },
          { createdAt: 'desc' }
        ],
        skip, take: limit
      })
    ]);

    const transformed = leaves.map(l => ({
      ...l,
      _id: l.id,
      leaveType: l.type?.name,
      userId: {
        _id: l.employee?.userId,
        id: l.employee?.userId,
        name: l.employee?.user?.name,
        employeeId: l.employee?.employeeCode
      },
      approvedBy: l.processedBy?.user ? { ...l.processedBy.user, _id: l.processedBy.user.id } : null
    }));


    return { data: transformed, pagination: buildPaginationMeta(total, page, limit) };
  },


  async apply(data, context) {
    const { organizationId, userId } = context;
    const employee = await prisma.employee.findUnique({ 
      where: { userId } 
    });
    if (!employee) throw new AppError('Employee profile not found', 404);

    // If leaveType (string) is passed, find leaveTypeId
    if (data.leaveType && !data.leaveTypeId) {
      const typeToFind = data.leaveType.toLowerCase() === 'lop' ? 'Loss of Pay' : data.leaveType;
      const lt = await prisma.leaveType.findFirst({
        where: {
          name: { contains: typeToFind, mode: 'insensitive' },
          organizationId
        }
      });
      if (lt) {
        data.leaveTypeId = lt.id;
      } else {
        throw new AppError(`Leave type '${data.leaveType}' not found. Please contact administrator.`, 400);
      }
    }

    if (!data.leaveTypeId) {
      throw new AppError('Leave type ID is required to apply for leave.', 400);
    }

    // Check for overlapping leaves
    const overlap = await prisma.leave.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        isDeleted: false,
        OR: [
          {
            startDate: { lte: new Date(data.endDate) },
            endDate: { gte: new Date(data.startDate) }
          }
        ]
      }
    });

    if (overlap) {
      throw new AppError('A leave request already exists for this date range.', 400);
    }

    const workingDays = await getWorkingDaysBetween(data.startDate, data.endDate, organizationId);

    const totalDays = workingDays.length * (!!data.isHalfDay ? 0.5 : 1);

    // Human-readable leave code LV-101
    const count = await prisma.leave.count({ where: { organizationId } });
    const leaveId = `LV-${101 + count}`;

    const leave = await prisma.leave.create({
      data: {
        leaveId,
        employeeId: employee.id,
        organizationId,
        leaveTypeId: data.leaveTypeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalDays,
        reason: data.reason || '',
        isHalfDay: !!data.isHalfDay,
        status: 'PENDING'
      }
    });

    const notifyWhere = { 
        organizationId, 
        isActive: true,
        isDeleted: false
    };

    const reporter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const message = `${reporter?.name || 'An employee'} applied for leave from ${format(new Date(data.startDate), 'MMM dd')} to ${format(new Date(data.endDate), 'MMM dd')}.`;

    // Fetch users with Leave Management > Leave Requests > approve permission
    const allUsers = await prisma.user.findMany({
      where: notifyWhere,
      include: { roleRef: true }
    });

    const adminsToNotify = allUsers.filter(u => {
        if (u.role === ROLES.SUPER_ADMIN || u.isOwner) return true;
        return hasPermission(u.roleRef?.permissions, 'Leave Management', 'Leave Requests', 'approve');
    });

    for (const admin of adminsToNotify) {
      await notificationService.create({
        userId: admin.id,
        organizationId,
        title: `New Leave Request [${leaveId}]`,
        message,
        type: 'LEAVE_APPLIED',
        refId: leave.id,
        refModel: 'Leave'
      }).catch(err => console.error('Failed to send notification:', err));
    }

    return leave;
  },


  async approve(id, approverId, organizationId) {
    return await prisma.$transaction(async (tx) => {
      const leave = await tx.leave.findUnique({ 
        where: { id_organizationId: { id, organizationId } }, 
        include: { type: true } 
      });
      if (!leave || leave.isDeleted) throw new AppError('Leave not found', 404);
      
      if (leave.status === 'APPROVED') return leave;

      const approverEmployee = await tx.employee.findUnique({
        where: { userId: approverId }
      });
      if (!approverEmployee) throw new AppError('Approver employee profile not found', 404);

      const updated = await tx.leave.update({ 
        where: { id_organizationId: { id, organizationId } }, 
        data: { 
          status: 'APPROVED',
          processedById: approverEmployee.id
        } 
      });

      // 1. Create system timesheets for the leave
      await createLeaveTimesheets(leave, approverEmployee.id, organizationId, tx);

      // 2. Deduct from balance if leave type is deductible
      if (leave.type && leave.type.isDeductible) {
        await tx.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId: {
              employeeId: leave.employeeId,
              leaveTypeId: leave.leaveTypeId
            }
          },
          update: {
            used: { increment: leave.totalDays },
            remaining: { decrement: leave.totalDays }
          },
          create: {
            employeeId: leave.employeeId,
            leaveTypeId: leave.leaveTypeId,
            total: leave.type.yearlyQuota,
            used: leave.totalDays,
            remaining: leave.type.yearlyQuota - leave.totalDays
          }
        });
      }

      // Notify user
      const victim = await tx.employee.findUnique({ where: { id: leave.employeeId }, select: { userId: true } });
      if (victim?.userId) {
        await notificationService.create({
          userId: victim.userId,
          organizationId,
          title: `Leave Approved [${leave.leaveId}]`,
          message: `Your leave request for ${format(new Date(leave.startDate), 'MMM dd')} - ${format(new Date(leave.endDate), 'MMM dd')} has been approved.`,
          type: 'LEAVE_APPROVED',
          refId: leave.id,
          refModel: 'Leave'
        }).catch(err => console.error('Failed to send notification:', err));
      }

      return updated;
    });
  },

  async reject(id, rejectorId, reason, organizationId) {
    return await prisma.$transaction(async (tx) => {
      const rejectorEmployee = await tx.employee.findUnique({
        where: { userId: rejectorId }
      });
      if (!rejectorEmployee) throw new AppError('Rejector employee profile not found', 404);

      const leave = await tx.leave.findUnique({ 
        where: { id_organizationId: { id, organizationId } },
        include: { type: true }
      });
      if (!leave || leave.isDeleted) throw new AppError('Leave not found', 404);

      // If rejecting an already APPROVED leave, we must revert timesheets and balance
      if (leave.status === 'APPROVED') {
        await removeLeaveTimesheets(leave, organizationId, tx);

        if (leave.type && leave.type.isDeductible) {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId: {
                employeeId: leave.employeeId,
                leaveTypeId: leave.leaveTypeId
              }
            }
          });
          if (balance) {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used: { decrement: leave.totalDays },
                remaining: { increment: leave.totalDays }
              }
            });
          }
        }
      }

      const updated = await tx.leave.update({ 
        where: { id_organizationId: { id, organizationId } }, 
        data: { 
          status: 'REJECTED',
          rejectionReason: reason || '',
          processedById: rejectorEmployee.id
        } 
      });

      // Notify user
      const victim = await tx.employee.findUnique({ where: { id: leave.employeeId }, select: { userId: true } });
      if (victim?.userId) {
        await notificationService.create({
          userId: victim.userId,
          organizationId,
          title: `Leave Rejected [${leave.leaveId}]`,
          message: `Your leave request for ${format(new Date(leave.startDate), 'MMM dd')} - ${format(new Date(leave.endDate), 'MMM dd')} was rejected. Reason: ${reason || 'No reason provided'}`,
          type: 'LEAVE_REJECTED',
          refId: leave.id,
          refModel: 'Leave'
        }).catch(err => console.error('Failed to send notification:', err));
      }

      return updated;
    });
  },



  async cancel(id, userId, reason, role, organizationId) {
    return await prisma.$transaction(async (tx) => {
      const leave = await tx.leave.findUnique({ 
        where: { id_organizationId: { id, organizationId } },
        include: { type: true }
      });
      if (!leave || leave.isDeleted) throw new AppError('Leave not found', 404);
      
      if (leave.status === 'APPROVED') {
        await removeLeaveTimesheets(leave, organizationId, tx);
        
        // Revert deduction from balance if leave type is deductible
        if (leave.type && leave.type.isDeductible) {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId: {
                employeeId: leave.employeeId,
                leaveTypeId: leave.leaveTypeId
              }
            }
          });
          if (balance) {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used: { decrement: leave.totalDays },
                remaining: { increment: leave.totalDays }
              }
            });
          }
        }
      }
      
      return await tx.leave.update({ 
        where: { id_organizationId: { id, organizationId } }, 
        data: { status: 'CANCELLED' } 
      });
    });
  },


  async getBalance(userId, organizationId) {
    const employee = await prisma.employee.findUnique({ 
      where: { userId },
      include: { 
        leaveBalances: { include: { leaveType: true } }
      }
    });

    if (!employee || employee.isDeleted) return {};

    // 1. Fetch all leave types for the organization
    const allTypes = await prisma.leaveType.findMany({ 
      where: { organizationId, isDeleted: false } 
    });

    // 2. Fetch all approved leaves to compute baseline used days (as a fallback)
    const approvedLeaves = await prisma.leave.findMany({
      where: { 
        employeeId: employee.id, 
        status: 'APPROVED', 
        isDeleted: false 
      },
      select: { leaveTypeId: true, totalDays: true }
    });

    const balance = {};
    
    // 3. Construct a complete balance object mapping every leave type
    allTypes.forEach(type => {
      const existingBalance = employee.leaveBalances.find(lb => lb.leaveTypeId === type.id);
      
      if (existingBalance) {
        // If a formal balance record exists, we trust its current state
        balance[type.name] = existingBalance.remaining;
      } else {
        // Fallback: Compute remaining days from yearly quota minus approved leaves
        const used = approvedLeaves
          .filter(l => l.leaveTypeId === type.id)
          .reduce((sum, l) => sum + (l.totalDays || 0), 0);
        
        balance[type.name] = type.yearlyQuota - used;
      }
    });

    return balance;
  },

  async getFilterOptions(organizationId) {
    const [types, employees, leaves] = await Promise.all([
    prisma.leaveType.findMany({ where: { organizationId } }),
      prisma.employee.findMany({ 
        where: { organizationId, isDeleted: false },
        include: { user: { select: { name: true } } }
      }),
      prisma.leave.findMany({
        where: { organizationId, isDeleted: false },
        select: { leaveId: true },
        distinct: ['leaveId']
      })
    ]);
    return {
      leaveTypes: types.map(t => ({ id: t.id, name: t.name })),
      employees: employees.map(e => ({ id: e.id, name: e.user.name })),
      statuses: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      leaveIds: leaves.map(l => l.leaveId).filter(Boolean)
    };
  }
};

module.exports = leaveService;
