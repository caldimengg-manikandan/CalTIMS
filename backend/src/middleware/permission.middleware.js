'use strict';

const { prisma } = require('../config/database');

/**
 * Middleware to check if the user has the required permission.
 * Supports hierarchical checks: hasPermission('Payroll', 'Payroll Engine', 'run')
 */
const hasPermission = (module, submodule, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

      // Admin bypass
      if (user.role && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'super_admin')) {
        return next();
      }

      let permissions = {};

      if (user.permissions && typeof user.permissions === 'object') {
        permissions = user.permissions;
      } else if (user.roleId) {
        const role = await prisma.role.findUnique({ where: { id: user.roleId } });
        permissions = role?.permissions || {};
      }

      // Wildcard check
      if (permissions.all?.all?.includes('all')) return next();

      if (module && !permissions[module]) {
        return forbidden(res, `No access to module: ${module}`);
      }

      if (submodule) {
        if (!permissions[module]?.[submodule]) {
          return forbidden(res, `No access to submodule: ${submodule} in ${module}`);
        }
        if (action) {
          const allowedActions = permissions[module][submodule];
          if (!Array.isArray(allowedActions) || (!allowedActions.includes(action) && !allowedActions.includes('all'))) {
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

const forbidden = (res, message) =>
  res.status(403).json({ success: false, message: `Forbidden: ${message}` });

module.exports = { hasPermission };
