'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        action: {
            type: String,
            required: true,
            index: true
        },
        role: {
            type: String, // Snapshot of the role name at the time of execution
            required: true,
        },
        entity: {
            type: String,
            required: true, // Output like 'Payroll', 'Employee', 'System'
            index: true
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILED', 'WARNING', 'SECURITY_WARNING', 'SECURITY_ALERT'],
            default: 'SUCCESS',
            index: true
        },
        ipAddress: {
            type: String,
            default: ''
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
    },
    {
        timestamps: true
    }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;

