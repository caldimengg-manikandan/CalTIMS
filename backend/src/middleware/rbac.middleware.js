'use strict';

const AppError = require('../shared/utils/AppError');
const { prisma } = require('../config/database');

/**
 * Role-based access control middleware factory.
 */
const authorize = (...roles) => {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(new AppError('You must be logged in to access this resource.', 401));
    const role = req.user.role?.toLowerCase();
    if (role === 'admin' || role === 'super_admin' || role === 'owner' || req.user.isOwner) return next();
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

/**
 * Granular permission check middleware using Role.permissions from database.
 */
const checkPermission = (module, submodule, action) => {
  return async (req, res, next) => {
    if (!req.user) return next(new AppError('You must be logged in to access this resource.', 401));

    const role = req.user.role?.toLowerCase();
    
    // RESTORED SAFE BYPASS: Always allow super_admin and isOwner (Master Keys)
    if (role === 'super_admin' || req.user.isOwner === true) return next();

    try {
      // Fetch the user's role from DB and check permissions
      const userRole = await prisma.role.findFirst({
        where: {
          organizationId: req.user.organizationId,
          name: { equals: req.user.role, mode: 'insensitive' },
        },
      });

      // Fallback: if no role found, allow non-strict endpoints
      if (!userRole) {
        // Silently allow if no role record exists (soft fail for legacy compat)
        return next();
      }

      const permissions = userRole.permissions || {};

      // LEACY/SIMPLE PERMISSION CHECK (Fallback)
      // If only one argument is provided (as a string), check if it exists in a flat structure or as a truthy value
      if (!submodule && !action && typeof module === 'string') {
          if (permissions[module] === true || (typeof permissions[module] === 'object' && Object.keys(permissions[module]).length > 0)) {
              return next();
          }
      }

      // Check for "all" wildcard
      if (permissions.all === true || permissions.all?.all?.includes('all')) return next();

      const auditService = require('../modules/audit/audit.service');

      // START GRANULAR CHECK
      if (module && !permissions[module] && !permissions.all) {
        await auditService.log(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', module, null, { submodule, action, reason: 'Module access denied' }, 'SECURITY_WARNING', req.ip);
        return next(new AppError(`Forbidden: No access to module: ${module}`, 403));
      }

      // If only module is provided but it's not a simple truthy check above
      if (!submodule && permissions[module]) return next(); 

      if (submodule && !permissions[module]?.[submodule] && !permissions[module]?.all && !permissions.all?.all) {
        await auditService.log(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', module, null, { submodule, action, reason: 'Submodule access denied' }, 'SECURITY_WARNING', req.ip);
        return next(new AppError(`Forbidden: No access to submodule: ${submodule}`, 403));
      }

      if (action) {
        const allowedActions = permissions[module]?.[submodule] || permissions[module]?.all || permissions.all?.all || [];
        if (!Array.isArray(allowedActions) || (!allowedActions.includes(action) && !allowedActions.includes('all'))) {
          const actionType = (module === 'Payroll' && action === 'disburse') ? 'UNAUTHORIZED_PAYMENT_ATTEMPT' : 'UNAUTHORIZED_ACTION_ATTEMPT';
          await auditService.log(req.user.id, actionType, module, null, { submodule, action }, 'SECURITY_WARNING', req.ip);
          return next(new AppError(`Forbidden: Missing action: ${action} in ${module} > ${submodule}`, 403));
        }
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
};

const authorizeOwnerOrRole = (userIdParam = 'id', roles = ['admin']) => {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('You must be logged in.', 401));
    const isOwner = req.user.id === req.params[userIdParam];
    const hasRole = roles.map(r => r.toLowerCase()).includes(req.user.role?.toLowerCase()) || req.user.role?.toLowerCase() === 'super_admin';
    if (!isOwner && !hasRole) return next(new AppError('You do not have permission to perform this action.', 403));
    next();
  };
};

const denyRoles = (...roles) => {
  return (req, res, next) => {
    const role = req.user?.role?.toLowerCase();
    if (roles.map(r => r.toLowerCase()).includes(role)) {
      return next(new AppError('Access denied for your role.', 403));
    }
    next();
  };
};

module.exports = { authorize, permit: authorize, authorizeOwnerOrRole, checkPermission, denyRoles };
