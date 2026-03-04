'use strict';

const express = require('express');
const router = express.Router();
const taskController = require('./task.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

// All task routes require auth
router.use(authenticate);

// Read routes: all authenticated users (employees need task lists for timesheets)
router.get('/', taskController.getAll);
router.get('/:id', taskController.getById);
router.post('/', authorize('admin'), taskController.create);
router.post('/bulk-create', authorize('admin'), taskController.bulkCreate);
router.put('/:id', authorize('admin'), taskController.update);
router.delete('/:id', authorize('admin'), taskController.delete);

module.exports = router;
