'use strict';

const AuditLog = require('./audit.model');
const socketService = require('../../shared/services/socket.service');
const User = require('../users/user.model');

/**
 * Creates an audit log entry and emits real-time activity.
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action performed (e.g. 'RUN_PAYROLL')
 * @param {string} entity - Type of entity (e.g. 'Payroll')
 * @param {string} entityId - ID of the entity changed
 * @param {object} metadata - Any additional metadata
 * @param {string} status - SUCCESS | FAILED | WARNING
 * @param {string} ipAddress - IP address of the user
 */
const log = async (userId, action, entity, entityId, metadata = {}, status = 'SUCCESS', ipAddress = '') => {
    try {
        const user = await User.findById(userId).populate('roleId');
        const roleName = user?.roleId?.name || user?.role || 'Unknown';
        const userName = user?.name || 'System';

        const auditLog = await AuditLog.create({
            performedBy: userId,
            action,
            role: roleName,
            entity,
            entityId,
            metadata,
            status,
            ipAddress
        });

        // Emit real-time activity
        socketService.emit('activity', {
            _id: auditLog._id,
            action,
            user: userName,
            role: roleName,
            status,
            timestamp: auditLog.createdAt,
            entity,
            entityId
        });

        return auditLog;
    } catch (err) {
        console.error('Failed to create audit log:', err.message);
    }
};

module.exports = { log };

