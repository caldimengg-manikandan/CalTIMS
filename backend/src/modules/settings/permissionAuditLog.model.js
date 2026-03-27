const mongoose = require('mongoose');

const permissionAuditLogSchema = new mongoose.Schema({
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: false // Can be null for deleted roles
  },
  roleName: {
    type: String,
    required: true
  },
  changedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedByName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['CREATE_ROLE', 'UPDATE_PERMISSION', 'DELETE_ROLE'],
    required: true
  },
  changes: [{
    module: String,
    submodule: String,
    action: String,
    previous: mongoose.Schema.Types.Mixed,
    current: mongoose.Schema.Types.Mixed
  }],
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false, // We use our own timestamp
  versionKey: false
});

// Make logs immutable via middleware (prevent updates/deletes)
permissionAuditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are immutable and cannot be updated.'));
  }
  next();
});

permissionAuditLogSchema.pre('remove', function(next) {
  return next(new Error('Audit logs are immutable and cannot be deleted.'));
});

const PermissionAuditLog = mongoose.model('PermissionAuditLog', permissionAuditLogSchema);

module.exports = PermissionAuditLog;
