'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const projectService = require('./project.service');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { projects, pagination } = await projectService.getAll(req.query, req.context);
  ApiResponse.success(res, { data: projects, pagination });
}));

router.post('/', checkPermission('Projects', 'Project List', 'create'), asyncHandler(async (req, res) => {
  const project = await projectService.create(req.body, req.context.organizationId);
  ApiResponse.created(res, { message: 'Project created', data: project });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const project = await projectService.getById(req.params.id, req.context.organizationId);
  ApiResponse.success(res, { data: project });
}));

router.put('/:id', checkPermission('Projects', 'Project List', 'edit'), asyncHandler(async (req, res) => {
  const project = await projectService.update(req.params.id, req.body, req.context);
  ApiResponse.success(res, { message: 'Project updated', data: project });
}));

router.patch('/:id/allocate', checkPermission('Projects', 'Project List', 'edit'), asyncHandler(async (req, res) => {
  const project = await projectService.allocate(req.params.id, req.body.allocations, req.context.organizationId);
  ApiResponse.success(res, { message: 'Employees allocated', data: project });
}));

router.delete('/:id/allocate/:userId', checkPermission('Projects', 'Project List', 'edit'), asyncHandler(async (req, res) => {
  const project = await projectService.deallocate(req.params.id, req.params.userId, req.context.organizationId);
  ApiResponse.success(res, { message: 'Employee removed from project', data: project });
}));

router.delete('/:id', checkPermission('Projects', 'Project List', 'delete'), asyncHandler(async (req, res) => {
  await projectService.delete(req.params.id, req.context);
  ApiResponse.success(res, { message: 'Project deleted successfully' });
}));

module.exports = router;
