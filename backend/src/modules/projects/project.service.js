const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { ROLES } = require('../../constants');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const notificationService = require('../notifications/notification.service');
const { hasPermission } = require('../../shared/utils/rbac');

const projectService = {
  async getAll(query, context) {
    const { organizationId } = context;
    const { page, limit, skip } = parsePagination(query);
    
    // Base scoping using helper
    const baseQuery = enforceOrg({ where: { isDeleted: false } }, organizationId);
    const where = baseQuery.where;

    if (query.status) {
      where.status = { equals: query.status, mode: 'insensitive' };
    }
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    if (query.code) where.code = query.code.toUpperCase();
    if (query.managerId) {
      // If it looks like a User ID (we fetch User list in frontend), resolve to Employee ID
      const emp = await prisma.employee.findFirst({
        where: { OR: [{ id: query.managerId }, { userId: query.managerId }], organizationId },
        select: { id: true }
      });
      if (emp) where.managerId = emp.id;
      else where.managerId = query.managerId; // Fallback
    }
    
    // Always exclude the system 'Leave' project from general lists
    where.code = { not: 'LEAVE-SYS', ...(query.code && { equals: query.code.toUpperCase() }) };

    // Restrict visibility for employees/managers if assignedOnly is requested
    const assignedOnly = query.assignedOnly === 'true';

    // Resolve the target user to an Employee ID for member-based filtering.
    // We prioritize query params over context to allow "view as" or "fill for" functionality.
    let targetUserId = query.userId;
    let targetEmployeeId = query.employeeId;

    // If neither is provided in query, default to the current authenticated user
    if (!targetUserId && !targetEmployeeId) {
      targetUserId = context.userId;
      targetEmployeeId = context.employeeId;
    }

    // Resolve targetUserId to targetEmployeeId if needed
    if (!targetEmployeeId && targetUserId) {
      const emp = await prisma.employee.findFirst({
        where: { userId: targetUserId, organizationId },
        select: { id: true }
      });
      if (emp) targetEmployeeId = emp.id;
    }

    const canViewAllProjects = hasPermission(context.permissions, 'Projects', 'Project List', 'view');

    if (assignedOnly || !canViewAllProjects && !context.isSuperAdmin && !context.isOwner) {
      where.OR = [
        { managerId: targetEmployeeId },
        { members: { some: { employeeId: targetEmployeeId } } }
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          manager: { include: { user: { select: { id: true, name: true, email: true } } } },
          members: { include: { employee: { include: { user: { select: { id: true, name: true, email: true } } } } } }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.project.count({ where }),
    ]);

    const formatted = projects.map(p => ({
      ...p,
      _id: p.id,
      manager: p.manager ? { ...p.manager.user, id: p.manager.id, _id: p.manager.user.id } : null,
      team_members: p.members.map(m => ({
        userId: m.employee.user.id,
        user: { ...m.employee.user, id: m.employee.id, _id: m.employee.user.id },
        role: m.role,
        allocationPercent: m.allocationPercent,
        budgetHours: m.budgetHours
      })),
      // Keep legacy keys for temporary compatibility during migration
      managerId: p.manager ? { ...p.manager.user, id: p.manager.id, _id: p.manager.user.id } : null,
      allocatedEmployees: p.members.map(m => ({ 
        userId: { ...m.employee.user, id: m.employee.id, _id: m.employee.user.id },
        role: m.role,
        allocationPercent: m.allocationPercent,
        budgetHours: m.budgetHours
      }))
    }));

    return { projects: formatted, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id, organizationId) {
    // Leverage the new composite unique constraint for maximum isolation
    const project = await prisma.project.findUnique({
      where: { 
        id_organizationId: { id, organizationId }
      },
      include: {
        manager: { include: { user: { select: { id: true, name: true, email: true } } } },
        members: { include: { employee: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } } } }
      }
    });

    if (!project || project.isDeleted) throw new AppError('Project not found', 404);
    
    return {
      ...project,
      _id: project.id,
      manager: project.manager ? { ...project.manager.user, id: project.manager.id, _id: project.manager.user.id } : null,
      team_members: project.members.map(m => ({
        userId: m.employee.user.id,
        user: { ...m.employee.user, id: m.employee.id, _id: project.manager.user.id },
        role: m.role,
        allocationPercent: m.allocationPercent,
        budgetHours: m.budgetHours
      })),
      // Legacy
      managerId: project.manager ? { ...project.manager.user, id: project.manager.id, _id: project.manager.user.id } : null,
      allocatedEmployees: project.members.map(m => ({
        userId: { ...m.employee.user, id: m.employee.id, _id: m.employee.user.id },
        role: m.role,
        allocationPercent: m.allocationPercent,
        budgetHours: m.budgetHours
      }))
    };
  },

  async create(data, organizationId) {
    if (!data.code) throw new AppError('Project code is required', 400);
    if (!data.endDate) throw new AppError('End date is required', 400);
    if (!data.allocatedEmployees || data.allocatedEmployees.length === 0) {
      throw new AppError('At least one team member is required', 400);
    }

    // Check uniqueness within the organization
    const existing = await prisma.project.findFirst({ 
      where: { 
        code: data.code.toUpperCase(), 
        organizationId, 
        isDeleted: false 
      } 
    });
    if (existing) throw new AppError(`Project with code '${data.code}' already exists`, 409);
    
    let { managerId, allocatedEmployees, startDate, endDate, ...rest } = data;

    // Resolve managerId if it's a User ID
    if (managerId) {
      const emp = await prisma.employee.findFirst({ 
        where: { OR: [{ id: managerId }, { userId: managerId }], organizationId } 
      });
      if (emp) managerId = emp.id;
    }

    const project = await prisma.project.create({
      data: {
        ...rest,
        code: data.code.toUpperCase(),
        organizationId,
        managerId: managerId || null,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        members: allocatedEmployees && allocatedEmployees.length > 0 ? {
          create: await Promise.all(allocatedEmployees.map(async (alloc) => {
            const emp = await prisma.employee.findFirst({ 
              where: { OR: [{ id: alloc.userId }, { userId: alloc.userId }], organizationId } 
            });
            if (!emp) throw new AppError(`Employee not found for user ID ${alloc.userId}`, 404);
            return {
              employeeId: emp.id,
              role: alloc.role || 'MEMBER',
              allocationPercent: Number(alloc.allocationPercent) || 100,
              budgetHours: Number(alloc.budgetHours) || 0
            };
          }))
        } : undefined
      },
      include: {
        manager: { include: { user: { select: { id: true, name: true, email: true } } } },
        members: { include: { employee: { include: { user: { select: { id: true, name: true, email: true } } } } } }
      }
    });

    const result = await this.getById(project.id, organizationId);

    // Notify Manager
    if (project.managerId) {
        const mgr = await prisma.employee.findUnique({ where: { id: project.managerId }, select: { userId: true } });
        if (mgr?.userId) {
            await notificationService.create({
                userId: mgr.userId, organizationId,
                title: 'Assigned as Project Manager',
                message: `You have been assigned as Project Manager for ${project.name} (${project.code}).`,
                type: 'PROJECT_ALLOCATED', refId: project.id, refModel: 'Project'
            }).catch(e => console.error(e));
        }
    }

    // Notify Members
    if (project.members) {
        for (const m of project.members) {
            const emp = await prisma.employee.findUnique({ where: { id: m.employeeId }, select: { userId: true } });
            if (emp?.userId) {
                await notificationService.create({
                    userId: emp.userId, organizationId,
                    title: 'Allocated to Project',
                    message: `You have been allocated to the project: ${project.name} (${project.code}).`,
                    type: 'PROJECT_ALLOCATED', refId: project.id, refModel: 'Project'
                }).catch(e => console.error(e));
            }
        }
    }

    return result;
  },

  async update(id, data, context) {
    const { organizationId } = context;
    
    // Verify existence and ownership
    const project = await prisma.project.findUnique({ 
      where: { id_organizationId: { id, organizationId } } 
    });
    
    if (!project || project.isDeleted) throw new AppError('Project not found', 404);
    
    const canEditProjects = hasPermission(context.permissions, 'Projects', 'Project List', 'edit');

    if (!canEditProjects && !context.isSuperAdmin && !context.isOwner) {
       // If not admin/authorized, check if they are the manager of this project
       if (project.managerId !== context.employeeId) {
          throw new AppError('You do not have permission to update this project', 403);
       }
    }

    if (data.code && data.code.toUpperCase() !== project.code) {
      const existing = await prisma.project.findFirst({ 
        where: { 
          code: data.code.toUpperCase(), 
          organizationId, 
          id: { not: id }, 
          isDeleted: false 
        } 
      });
      if (existing) throw new AppError(`Project with code '${data.code}' already exists`, 409);
    }

    if (data.endDate === null || data.endDate === '') throw new AppError('End date cannot be empty', 400);
    if (data.allocatedEmployees && data.allocatedEmployees.length === 0) {
      throw new AppError('At least one team member must be assigned', 400);
    }

    let { managerId, allocatedEmployees, startDate, endDate, ...updateData } = data;

    // Resolve managerId if it's a User ID
    if (managerId) {
      const emp = await prisma.employee.findFirst({ 
        where: { OR: [{ id: managerId }, { userId: managerId }], organizationId } 
      });
      if (emp) managerId = emp.id;
    }

    // Handle members update separately to be safe or via nested update
    // Use a transaction to ensure atomicity
    const updated = await prisma.$transaction(async (tx) => {
        if (allocatedEmployees) {
            const resolvedMembers = [];
            for (const alloc of allocatedEmployees) {
                const emp = await tx.employee.findFirst({ 
                    where: { OR: [{ id: alloc.userId }, { userId: alloc.userId }], organizationId } 
                });
                if (emp) {
                    resolvedMembers.push({
                        projectId: id,
                        employeeId: emp.id,
                        role: alloc.role || 'MEMBER',
                        allocationPercent: Number(alloc.allocationPercent) || 100,
                        budgetHours: Number(alloc.budgetHours) || 0
                    });
                }
            }

            await tx.projectMember.deleteMany({ where: { projectId: id } });
            if (resolvedMembers.length > 0) {
                await tx.projectMember.createMany({
                    data: resolvedMembers
                });
            }
        }

        return await tx.project.update({
            where: { 
                id_organizationId: { id, organizationId }
            },
            data: {
                ...updateData,
                code: data.code ? data.code.toUpperCase() : project.code,
                managerId: managerId !== undefined ? managerId : undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined
            }
        });
    });

    const result = await this.getById(id, organizationId);

    // If manager changed, notify new manager
    if (managerId && managerId !== project.managerId) {
        const mgr = await prisma.employee.findUnique({ where: { id: managerId }, select: { userId: true } });
        if (mgr?.userId) {
            await notificationService.create({
                userId: mgr.userId, organizationId,
                title: 'Assigned as Project Manager',
                message: `You have been assigned as Project Manager for ${updated.name} (${updated.code}).`,
                type: 'PROJECT_ALLOCATED', refId: id, refModel: 'Project'
            }).catch(e => console.error(e));
        }
    }

    return result;
  },

  async allocate(id, allocations, organizationId) {
    // Ensure project exists in this org
    const project = await prisma.project.findUnique({ 
      where: { id_organizationId: { id, organizationId } } 
    });
    if (!project || project.isDeleted) throw new AppError('Project not found', 404);

    const operations = allocations.map(alloc => {
      return prisma.projectMember.upsert({
        where: { projectId_employeeId: { projectId: id, employeeId: alloc.employeeId } },
        create: { projectId: id, employeeId: alloc.employeeId, role: alloc.role || 'MEMBER' },
        update: { role: alloc.role || 'MEMBER' }
      });
    });

    await prisma.$transaction(operations);
    
    // Notify employees
    for (const alloc of allocations) {
        const emp = await prisma.employee.findUnique({
            where: { id: alloc.employeeId },
            select: { userId: true }
        });
        if (emp?.userId) {
            await notificationService.create({
                userId: emp.userId,
                organizationId,
                title: 'Project Allocated',
                message: `You have been allocated to the project: ${project.name} (${project.code}).`,
                type: 'PROJECT_ALLOCATED',
                refId: id,
                refModel: 'Project'
            }).catch(err => console.error('Failed to send notification:', err));
        }
    }

    return this.getById(id, organizationId);
  },

  async deallocate(projectId, employeeId, organizationId) {
    const project = await prisma.project.findUnique({ 
      where: { id_organizationId: { id: projectId, organizationId } } 
    });
    if (!project || project.isDeleted) throw new AppError('Project not found', 404);

    await prisma.projectMember.deleteMany({
      where: { projectId, employeeId }
    });
    return this.getById(projectId, organizationId);
  },

  async delete(id, context) {
    const { organizationId } = context;
    
    const project = await prisma.project.findUnique({ 
      where: { id_organizationId: { id, organizationId } } 
    });
    if (!project || project.isDeleted) throw new AppError('Project not found', 404);
    
    const canDeleteProjects = hasPermission(context.permissions, 'Projects', 'Project List', 'delete');
    
    if (!canDeleteProjects && !context.isSuperAdmin && !context.isOwner) {
      throw new AppError('Only authorized users can delete projects', 403);
    }

    await prisma.project.update({
      where: { id_organizationId: { id, organizationId } },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    return true;
  },
};

module.exports = projectService;
