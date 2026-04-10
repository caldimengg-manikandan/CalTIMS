'use strict';

const { prisma } = require('../../config/database');
const socketService = require('../../shared/services/socket.service');
const logger = require('../../shared/utils/logger');

/**
 * Expanded Audit Logging Service
 * Tracks system changes, before/after states, and security events.
 */
const log = async (userId, action, entity, entityId, metadata = {}, status = 'SUCCESS', ipAddress = '') => {
  try {
    let user = null;
    if (userId) {
      // Find user but since we don't have orgId here, we use findUnique with id (safe for system logs)
      user = await prisma.user.findUnique({ 
        where: { id: userId }, 
        select: { role: true, name: true, organizationId: true } 
      });
    }

    const roleName = user?.role || 'Unknown';
    const userName = user?.name || 'System';
    const organizationId = metadata.organizationId || user?.organizationId;

    if (!organizationId) {
      logger.warn(`Audit log attempted without organizationId: ${action}`);
      return null;
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action,
        resource: entity,
        // Expanded details to include before/after if present in metadata
        details: { 
          entityId, 
          status, 
          ipAddress,
          before: metadata.before || null,
          after: metadata.after || null,
          message: metadata.message || '',
          ...metadata 
        },
      },
    });

    try {
      socketService.emit('activity', {
        id: auditLog.id,
        organizationId,
        action,
        user: userName,
        role: roleName,
        status,
        timestamp: auditLog.createdAt,
        entity,
        entityId,
      }, { room: [`org_${organizationId}`, 'global_audit'] });
    } catch (_) {}

    return auditLog;
  } catch (err) {
    console.error('Failed to create audit log:', err.message);
  }
};

/**
 * Standardized logAction for context-aware logging
 */
const logAction = async ({ userId, action, entityType, entityId, details, organizationId, status = 'SUCCESS', ipAddress = '' }) => {
  return await log(userId, action, entityType, entityId, { ...details, organizationId }, status, ipAddress);
};

module.exports = { log, logAction };
