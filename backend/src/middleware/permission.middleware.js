'use strict';

const mongoose = require('mongoose');
const Role = require('../modules/users/role.model');

/**
 * Middleware to check if the user has the required permission.
 * Supports hierarchical checks: hasPermission('Payroll', 'Payroll Engine', 'run')
 * @param {string} module - The top-level module (e.g., 'Payroll')
 * @param {string} submodule - (Optional) The submodule (e.g., 'Payroll Engine')
 * @param {string} action - (Optional) The specific action (e.g., 'run')
 */
const hasPermission = (module, submodule, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      // 1. Admin bypass (if system role or role name is admin)
      if (user.role && user.role.toLowerCase() === 'admin') {
        return next();
      }

      // 2. Fetch role permissions
      let permissions = {};
      
      // Check if permissions are already attached to req.user (from auth middleware)
      if (user.permissions && typeof user.permissions === 'object') {
        permissions = user.permissions;
      } else if (user.roleId) {
        const role = await Role.findById(user.roleId).lean();
        permissions = role?.permissions || {};
      }

      // 3. Hierarchical validation
      if (!permissions[module]) {
        return forbidden(res, `No access to module: ${module}`);
      }

      if (submodule) {
        if (!permissions[module][submodule]) {
          return forbidden(res, `No access to submodule: ${submodule} in ${module}`);
        }

        if (action) {
          const allowedActions = permissions[module][submodule];
          if (!Array.isArray(allowedActions) || !allowedActions.includes(action)) {
            return forbidden(res, `Missing action: ${action} in ${module} > ${submodule}`);
          }
        }
      }

      return next();
    } catch (err) {
      next(err);
    }
  };
};

const forbidden = (res, message) => {
  return res.status(403).json({
    success: false,
    message: `Forbidden: ${message}`
  });
};

module.exports = { hasPermission };
