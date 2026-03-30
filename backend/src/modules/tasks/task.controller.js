'use strict';

const taskService = require('./task.service');

class TaskController {
  async getAll(req, res, next) {
    try {
      const organizationId = req.organizationId;
      const { data, pagination } = await taskService.getAll(req.query, organizationId);
      res.status(200).json({ success: true, data, pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const organizationId = req.organizationId;
      const task = await taskService.getById(req.params.id, organizationId);
      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }
      res.status(200).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const organizationId = req.organizationId;
      const task = await taskService.create({ ...req.body, organizationId });
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async bulkCreate(req, res, next) {
    try {
      const { tasks } = req.body;
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ success: false, message: 'Tasks must be an array' });
      }
      const organizationId = req.organizationId;
      const data = await taskService.bulkCreate(tasks, organizationId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const organizationId = req.organizationId;
      const task = await taskService.update(req.params.id, req.body, organizationId);
      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }
      res.status(200).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const organizationId = req.organizationId;
      const task = await taskService.delete(req.params.id, organizationId);
      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }
      res.status(200).json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TaskController();
