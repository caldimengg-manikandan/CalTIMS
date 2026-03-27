'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');
const AuditLog = require('./audit.model');

// @route   GET /api/audit
// @desc    Get audit logs — admins see all; others see only their own
// @access  Private
router.get(
    '/',
    authenticate,
    checkSubscription,
    requireFeature('audit_logs'),
    asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const query = {};

        // Role-based scoping: non-admins only see their own logs
        const isAdmin = req.user.role && req.user.role.toLowerCase() === 'admin';
        if (!isAdmin) {
            query.performedBy = req.user.id;
        }

        // Filters (using correct schema field names)
        if (req.query.action) query.action = req.query.action;
        if (req.query.entity) query.entity = req.query.entity;
        if (req.query.entityId) query.entityId = req.query.entityId;
        if (req.query.status) query.status = req.query.status;

        // Date filtering
        if (req.query.from || req.query.to) {
            query.createdAt = {};
            if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
            if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
        }

        const total = await AuditLog.countDocuments(query);
        const logs = await AuditLog.find(query)
            .populate('performedBy', 'name email role')  // Fixed: was .populate('userId') which doesn't exist
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            count: logs.length,
            total,
            data: logs,
        });
    })
);

const auditService = require('./audit.service');

/**
 * Legacy/Facade function for logging audit actions.
 * Used by multiple modules including settings, timesheets, and leaves.
 * @param {object} param0 - The audit log data
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
