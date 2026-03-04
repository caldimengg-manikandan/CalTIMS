'use strict';

const Project = require('./project.model');
const AppError = require('../../shared/utils/AppError');
const { parsePagination, buildPaginationMeta, buildSort } = require('../../shared/utils/pagination');
const { ROLES } = require('../../constants');

const projectService = {
  async getAll(query, requestor) {
    const { page, limit, skip } = parsePagination(query);
    const sort = buildSort(query);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.search) filter.name = new RegExp(query.search, 'i');
    if (query.code) filter.code = query.code.toUpperCase();
    if (query.managerId) filter.managerId = query.managerId;
    
    // Always exclude the system 'Leave' project from general lists
    filter.code = { ... (query.code && { $eq: query.code.toUpperCase() }), $ne: 'LEAVE-SYS' };

    // Employees see only their allocated projects
    if (requestor.role === ROLES.EMPLOYEE) {
      filter['allocatedEmployees.userId'] = requestor._id;
    }
    if (requestor.role === ROLES.MANAGER) {
      filter.$or = [{ managerId: requestor._id }, { 'allocatedEmployees.userId': requestor._id }];
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('managerId', 'name email employeeId')
        .populate('allocatedEmployees.userId', 'name email employeeId')
        .skip(skip).limit(limit).sort(sort).lean(),
      Project.countDocuments(filter),
    ]);

    return { projects, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id) {
    const project = await Project.findById(id)
      .populate('managerId', 'name email employeeId')
      .populate('allocatedEmployees.userId', 'name email employeeId department');
    if (!project) throw new AppError('Project not found', 404);
    return project;
  },

  async create(data) {
    const existing = await Project.findOne({ code: data.code.toUpperCase() });
    if (existing) throw new AppError(`Project with code '${data.code}' already exists`, 409);
    return Project.create(data);
  },

  async update(id, data, requestor) {
    const project = await Project.findById(id);
    if (!project) throw new AppError('Project not found', 404);
    if (requestor.role === ROLES.MANAGER && project.managerId.toString() !== requestor._id.toString()) {
      throw new AppError('Managers can only update their own projects', 403);
    }
    Object.assign(project, data);
    await project.save();
    return project;
  },

  async allocate(id, allocations, requestor) {
    const project = await Project.findById(id);
    if (!project) throw new AppError('Project not found', 404);

    for (const alloc of allocations) {
      const existing = project.allocatedEmployees.findIndex(
        (a) => a.userId.toString() === alloc.userId
      );
      if (existing >= 0) {
        Object.assign(project.allocatedEmployees[existing], alloc);
      } else {
        project.allocatedEmployees.push(alloc);
      }
    }
    await project.save();
    return project.populate('allocatedEmployees.userId', 'name email employeeId');
  },

  async deallocate(projectId, userId) {
    const project = await Project.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);
    project.allocatedEmployees = project.allocatedEmployees.filter(
      (a) => a.userId.toString() !== userId
    );
    await project.save();
    return project;
  },

  async delete(id, requestor) {
    const project = await Project.findById(id);
    if (!project) throw new AppError('Project not found', 404);
    
    // Only admins can delete projects
    if (requestor.role !== ROLES.ADMIN) {
      throw new AppError('Only admins can delete projects', 403);
    }

    await Project.findByIdAndDelete(id);
    return true;
  },
};

module.exports = projectService;
