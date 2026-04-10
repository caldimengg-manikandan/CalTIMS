'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');
const { prisma } = require('../../config/database');
const auditService = require('./audit.service');

// GET /api/v1/audit
router.get(
  '/',
  authenticate,
  checkSubscription,
  requireFeature('audit_logs'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const isSuperAdmin = req.user.role === 'super_admin';
    const where = isSuperAdmin ? {} : { organizationId: req.user.organizationId };

    if (!isSuperAdmin) {
      // Organization Admin check (includes Owner role)
      const isAdmin = req.user.role && (
        req.user.role.toLowerCase() === 'admin' || 
        req.user.role.toLowerCase() === 'owner'
      );
      if (!isAdmin) where.userId = req.user.id;
    } else {
      // Super admins can optionally filter by organization
      if (req.query.organizationId) where.organizationId = req.query.organizationId;
    }

    if (req.query.action) where.action = req.query.action;
    if (req.query.entity) where.resource = req.query.entity;
    
    // Status is inside details JSON
    if (req.query.status) {
      where.details = {
        path: ['status'],
        equals: req.query.status
      };
    }

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mappedLogs = logs.map(log => ({
      ...log,
      performedBy: log.user,
      role: log.user?.role || 'System',
      status: log.details?.status || 'SUCCESS',
      entity: log.resource,
      ipAddress: log.details?.ipAddress || '-'
    }));

    res.json({ 
      success: true, 
      count: mappedLogs.length, 
      total, 
      data: mappedLogs,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  })
);

/**
 * Legacy/Facade function for logging audit actions.
 * Used by multiple modules including settings, timesheets, and leaves.
 */
const logAction = async ({ userId, action, entityType, entityId, details, metadata, status, ipAddress }) => {
  return auditService.log(
    userId,
    action,
    entityType || 'Action',
    entityId || null,
    details || metadata || {},
    status || 'SUCCESS',
    ipAddress || ''
  );
};

module.exports = { router, logAction };
