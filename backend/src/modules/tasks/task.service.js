'use strict';

const Task = require('./task.model');
const Project = require('../projects/project.model');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');

class TaskService {
  async getAll(query = {}, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const { search, projectId, status, isActive } = query;
    const filter = { organizationId };

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (projectId) {
      filter.projectId = projectId;
    }

    if (status) {
      filter.status = status;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('projectId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Task.countDocuments(filter),
    ]);

    return { 
      data: tasks, 
      pagination: buildPaginationMeta(total, page, limit) 
    };
  }

  async getById(id, organizationId) {
    return await Task.findOne({ _id: id, organizationId }).populate('projectId', 'name code');
  }

  async create(data) {
    // Note: organizationId check handled by controller passing it in data
    return await Task.create(data);
  }

  async bulkCreate(tasks, organizationId) {
    const tasksWithOrg = tasks.map(t => ({ ...t, organizationId }));
    return await Task.insertMany(tasksWithOrg);
  }

  async update(id, data, organizationId) {
    return await Task.findOneAndUpdate({ _id: id, organizationId }, data, { new: true, runValidators: true });
  }

  async delete(id, organizationId) {
    return await Task.findOneAndDelete({ _id: id, organizationId });
  }
}

module.exports = new TaskService();
