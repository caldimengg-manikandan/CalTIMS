'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const projectService = require('./project.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { projects, pagination } = await projectService.getAll(req.query, req.user);
  ApiResponse.success(res, { data: projects, pagination });
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const project = await projectService.create(req.body);
  ApiResponse.created(res, { message: 'Project created', data: project });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const project = await projectService.getById(req.params.id);
  ApiResponse.success(res, { data: project });
}));

router.put('/:id', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const project = await projectService.update(req.params.id, req.body, req.user);
  ApiResponse.success(res, { message: 'Project updated', data: project });
}));

router.patch('/:id/allocate', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const project = await projectService.allocate(req.params.id, req.body.allocations, req.user);
  ApiResponse.success(res, { message: 'Employees allocated', data: project });
}));

router.delete('/:id/allocate/:userId', authorize('admin'), asyncHandler(async (req, res) => {
  const project = await projectService.deallocate(req.params.id, req.params.userId);
  ApiResponse.success(res, { message: 'Employee removed from project', data: project });
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  await projectService.delete(req.params.id, req.user);
  ApiResponse.success(res, { message: 'Project deleted successfully' });
}));

module.exports = router;
