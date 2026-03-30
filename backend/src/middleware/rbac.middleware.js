const AppError = require('../shared/utils/AppError');
const Settings = require('../modules/settings/settings.model');

/**
 * Role-based access control middleware factory.
 * Usage: authorize(['admin', 'manager'])
 */
const authorize = (...roles) => {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource.', 401));
    }
    if (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'super_admin')) {
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

/**
 * Granular permission check middleware factory.
 * Supports hierarchical checks: checkPermission('Payroll', 'Payroll Engine', 'approve')
 * @param {string} module - The top-level module (e.g., 'Payroll')
 * @param {string} submodule - (Optional) The submodule (e.g., 'Payroll Engine')
 * @param {string} action - (Optional) The specific action (e.g., 'run')
 */
const checkPermission = (module, submodule, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource.', 401));
    }

    // Safety: Admin role always bypasses granular checks
    if (req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'super_admin')) {
      return next();
    }

    try {
      // Fetch settings (singleton)
      const settings = await Settings.findOne().lean();
      if (!settings) {
        return next(new AppError('Permission denied (Settings not initialized)', 403));
      }

      // Find the user's role in the settings
      const userRole = settings.roles.find(r => r.name.toLowerCase() === req.user.role.toLowerCase());
      
      if (!userRole) {
        return next(new AppError(`Role '${req.user.role}' not found in permission profiles.`, 403));
      }

      const permissions = userRole.permissions || {};

      const auditService = require('../modules/audit/audit.service');
      // Hierarchical validation
      if (!permissions[module]) {
        await auditService.log(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', module, null, { submodule, action, reason: 'Module access denied' }, 'SECURITY_WARNING', req.ip);
        return next(new AppError(`Forbidden: No access to module: ${module}`, 403));
      }

      if (submodule) {
        if (!permissions[module][submodule]) {
          await auditService.log(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', module, null, { submodule, action, reason: 'Submodule access denied' }, 'SECURITY_WARNING', req.ip);
          return next(new AppError(`Forbidden: No access to submodule: ${submodule} in ${module}`, 403));
        }

        if (action) {
          const allowedActions = permissions[module][submodule];
          if (!Array.isArray(allowedActions) || !allowedActions.includes(action)) {
            // Special log for payroll disbursement as requested in E2E requirements
            const actionType = (module === 'Payroll' && action === 'disburse') ? 'UNAUTHORIZED_PAYMENT_ATTEMPT' : 'UNAUTHORIZED_ACTION_ATTEMPT';
            await auditService.log(req.user.id, actionType, module, null, { submodule, action, reason: 'Action permission missing' }, 'SECURITY_WARNING', req.ip);
            return next(new AppError(`Forbidden: Missing action: ${action} in ${module} > ${submodule}`, 403));
          }
        }
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Allow access only to the resource owner OR admin/manager
 * Usage: authorizeOwnerOrRole(req.params.id, ['admin'])
 */
const authorizeOwnerOrRole = (userIdParam = 'id', roles = ['admin']) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in.', 401));
    }
    const isOwner = req.user._id.toString() === req.params[userIdParam];
    const hasRole = roles.map(r => r.toLowerCase()).includes(req.user.role.toLowerCase()) || req.user.role.toLowerCase() === 'super_admin';
    if (!isOwner && !hasRole) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { authorize, permit: authorize, authorizeOwnerOrRole, checkPermission };
