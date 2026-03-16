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
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

/**
 * Granular permission check middleware factory.
 * Usage: checkPermission('approveTimesheets')
 */
const checkPermission = (permissionKey) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource.', 401));
    }

    // Safety: Admin role always bypasses granular checks
    if (req.user.role && req.user.role.toLowerCase() === 'admin') {
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

      // Check the specific permission
      if (userRole.permissions && userRole.permissions[permissionKey]) {
        return next();
      }

      return next(new AppError('You do not have the required permission to perform this action.', 403));
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
    const hasRole = roles.map(r => r.toLowerCase()).includes(req.user.role.toLowerCase());
    if (!isOwner && !hasRole) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { authorize, authorizeOwnerOrRole, checkPermission };
