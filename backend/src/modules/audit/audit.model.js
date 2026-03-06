'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false // some actions might be system actions
        },
        action: {
            type: String,
            required: true,
            index: true
        },
        entityType: {
            type: String,
            required: true, // Output like 'Timesheet', 'Settings', 'Project'
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        ipAddress: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
