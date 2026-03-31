'use strict';

const UserActivityLog = require('../../modules/audit/userActivityLog.model');
const logger = require('./logger');

/**
 * Log a user activity to the database
 */
const logActivity = async ({ userId, organizationId, action, entityType, entityId, details, req }) => {
  // Safe Logging Wrapper: Only log to database if organizationId is present.
  // New users (e.g., from Google OAuth) don't have an organizationId until after onboarding.
  if (!organizationId) {
    return;
  }

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
