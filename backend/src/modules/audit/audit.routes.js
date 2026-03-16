'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../shared/utils/asyncHandler');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkPermission } = require('../../middleware/rbac.middleware');
const AuditLog = require('./audit.model');

// @route   GET /api/audit
// @desc    Get all audit logs (based on granular permissions)
// @access  Private
router.get(
    '/',
    authenticate,
    checkPermission('viewAuditLogs'),
    asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.action) query.action = req.query.action;
        if (req.query.entityType) query.entityType = req.query.entityType;
        if (req.query.entityId) query.entityId = req.query.entityId;
        if (req.query.userId) query.userId = req.query.userId;

        // Date filtering mapping for standard ?from= and ?to=
        if (req.query.from || req.query.to) {
            query.createdAt = {};
            if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
            if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
        }

        const total = await AuditLog.countDocuments(query);
        const logs = await AuditLog.find(query)
            .populate('userId', 'name email role')
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

// Minimal explicit export for creating logs from other services
const logAction = async ({ userId, action, entityType, entityId, details, ipAddress }) => {
    try {
        await AuditLog.create({ userId, action, entityType, entityId, details, ipAddress });
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
};

module.exports = {
    router,
    logAction
};
