'use strict';

const UserActivityLog = require('../../modules/audit/userActivityLog.model');
const logger = require('./logger');

/**
 * Log a user activity to the database
 */
const logActivity = async ({ userId, organizationId, action, entityType, entityId, details, req }) => {
  try {
    await UserActivityLog.create({
      userId,
      organizationId,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
  } catch (err) {
    logger.error('Failed to log user activity:', err);
  }
};

module.exports = { logActivity };
