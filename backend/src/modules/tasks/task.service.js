'use strict';

const Task = require('./task.model');
const Project = require('../projects/project.model');

class TaskService {
  async getAll(filters = {}) {
    const { search, projectId, status, isActive } = filters;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (projectId) {
      query.projectId = projectId;
    }

    if (status) {
      query.status = status;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true' || isActive === true;
    }

    return await Task.find(query).populate('projectId', 'name code').sort({ createdAt: -1 });
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
