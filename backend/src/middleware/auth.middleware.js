'use strict';

const jwt = require('jsonwebtoken');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/utils/AppError');
const { prisma } = require('../config/database');

/**
 * Validate JWT access token from Authorization header
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    return next(new AppError('Invalid or expired token. Please log in again.', 401));
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: { 
      roleRef: true,
      employee: { select: { id: true } }
    },
  });

  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact an administrator.', 403));
  }

  const employeeId = currentUser.employee?.id;

  // Normalize user object — provide .id on req.user
  req.user = {
    id: currentUser.id,
    _id: currentUser.id, // legacy compat
    employeeId,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    roleId: currentUser.roleId,
    permissions: currentUser.roleRef?.permissions || {},
    organizationId: currentUser.organizationId,
    isActive: currentUser.isActive,
    isOwner: currentUser.isOwner,
  };
  req.organizationId = currentUser.organizationId;

  // Modern Context Injection
  req.context = {
    userId: currentUser.id,
    employeeId,
    organizationId: currentUser.organizationId,
    role: currentUser.role,
    isOwner: currentUser.isOwner,
    isSuperAdmin: currentUser.role === 'super_admin',
    permissions: currentUser.roleRef?.permissions || {}
  };

  next();
});

/**
 * Restrict access to specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { authenticate, authorize };
