'use strict';

const jwt = require('jsonwebtoken');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/utils/AppError');
const User = require('../modules/users/user.model');

/**
 * Validate JWT access token from Authorization header
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  // Verify token
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

  // Check user still exists
  const currentUser = await User.findById(decoded.sub).select('+isActive');
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact an administrator.', 403));
  }

  // Attach user and organizationId to request
  req.user = currentUser;
  req.organizationId = currentUser.organizationId;
  next();
});

/**
 * Restrict access to specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { authenticate, authorize };
