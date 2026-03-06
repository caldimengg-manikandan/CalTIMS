'use strict';

const Task = require('./task.model');
const Project = require('../projects/project.model');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');

class TaskService {
  async getAll(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const { search, projectId, status, isActive } = query;
    const filter = {};

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

  async getById(id) {
    return await Task.findById(id).populate('projectId', 'name code');
  }

  async create(data) {
    return await Task.create(data);
  }

  async bulkCreate(tasks) {
    return await Task.insertMany(tasks);
  }

  async update(id, data) {
    return await Task.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return await Task.findByIdAndDelete(id);
  }
}

module.exports = new TaskService();
