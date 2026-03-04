'use strict';

const AppError = require('../shared/utils/AppError');

/**
 * Role-based access control middleware factory.
 * Usage: authorize(['admin', 'manager'])
 */
const authorize = (...roles) => {
  // Flatten in case array is passed
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
 * Allow access only to the resource owner OR admin/manager
 * Usage: authorizeOwnerOrRole(req.params.id, ['admin'])
 */
const authorizeOwnerOrRole = (userIdParam = 'id', roles = ['admin']) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in.', 401));
    }
    const isOwner = req.user._id.toString() === req.params[userIdParam];
    const hasRole = roles.includes(req.user.role);
    if (!isOwner && !hasRole) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { authorize, authorizeOwnerOrRole };
