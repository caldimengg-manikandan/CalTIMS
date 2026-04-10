'use strict';

const { prisma } = require('../../config/database');
const logger = require('./logger');

/**
 * Log a user activity to the database (Prisma version)
 */
const logActivity = async ({ userId, organizationId, action, entityType, entityId, details, req }) => {
  if (!organizationId) return;

  try {
    await prisma.userActivityLog.create({
      data: {
        userId,
        organizationId,
        action,
        resource: entityType || null,
        details: details || null,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (err) {
    logger.error('Failed to log user activity:', err);
  }
};

module.exports = { logActivity };
