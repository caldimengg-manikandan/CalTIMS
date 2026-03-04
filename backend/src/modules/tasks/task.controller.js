'use strict';

const taskService = require('./task.service');

class TaskController {
  async getAll(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        projectId: req.query.projectId,
        status: req.query.status,
        isActive: req.query.isActive,
      };
      const tasks = await taskService.getAll(filters);
      res.status(200).json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const task = await taskService.getById(req.params.id);
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
      const task = await taskService.create(req.body);
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
      const data = await taskService.bulkCreate(tasks);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const task = await taskService.update(req.params.id, req.body);
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
      const task = await taskService.delete(req.params.id);
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
