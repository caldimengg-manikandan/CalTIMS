const { prisma } = require('../../config/database');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');

class TaskService {
  async getAll(query = {}, context) {
    const { organizationId, role, employeeId, userId } = context;
    const { page, limit, skip } = parsePagination(query);
    const { search, projectId, status } = query;
    
    const where = { organizationId, isDeleted: false };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status;
    }

    // Filter by assignee if requested OR if the user is an employee/manager (unless they are admin)
    const assignedOnly = query.assignedOnly === 'true';
    
    // Determine the target for "assigned only" filtering.
    // We prioritize query params to allow admins to view tasks for a specific user.
    let targetUserId = query.userId;
    let targetEmployeeId = query.employeeId;

    // If no target is specified but filtering is required (either by flag or role), default to current user
    if (!targetUserId && !targetEmployeeId && (assignedOnly || role === 'employee' || role === 'manager')) {
      targetUserId = userId;
      targetEmployeeId = employeeId;
    }

    if (targetUserId || targetEmployeeId) {
      where.assignees = {
        some: {
          OR: [
            ...(targetEmployeeId ? [{ id: targetEmployeeId }] : []),
            ...(targetUserId ? [{ userId: targetUserId }] : [])
          ]
        }
      };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { project: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.task.count({ where }),
    ]);

    return { 
      data: tasks, 
      pagination: buildPaginationMeta(total, page, limit) 
    };
  }

  async getById(id, organizationId) {
    return await prisma.task.findFirst({
        where: { id, organizationId, isDeleted: false },
        include: { project: { select: { name: true, code: true } } }
    });
  }

  async create(data) {
    const { name, description, projectId, organizationId, priority, status, dueDate } = data;
    return await prisma.task.create({
      data: {
        name,
        description,
        projectId,
        organizationId,
        priority: (priority || 'MEDIUM').toUpperCase(),
        status: (status || 'TODO').toUpperCase(),
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });
  }

  async bulkCreate(tasks, organizationId) {
    const cleanedTasks = tasks.map(t => ({
      name: t.name,
      description: t.description,
      projectId: t.projectId,
      organizationId,
      priority: (t.priority || 'MEDIUM').toUpperCase(),
      status: (t.status || 'TODO').toUpperCase(),
      dueDate: t.dueDate ? new Date(t.dueDate) : null
    }));
    return await prisma.task.createMany({ data: cleanedTasks });
  }

  async update(id, data, organizationId) {
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'description', 'projectId', 'priority', 'status', 'dueDate', 'isDeleted'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        if (field === 'priority' || field === 'status') {
          updateData[field] = data[field].toUpperCase();
        } else if (field === 'dueDate' && data[field]) {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    });

    return await prisma.task.update({
      where: { id },
      data: updateData
    });
  }

  async delete(id, organizationId) {
    return await prisma.task.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() }
    });
  }
}

module.exports = new TaskService();
