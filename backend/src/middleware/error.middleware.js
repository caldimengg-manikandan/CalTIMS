'use strict';

const AppError = require('../shared/utils/AppError');
const logger = require('../shared/utils/logger');
const { HTTP_STATUS } = require('../constants');

/**
 * Handle specific Prisma / JWT error types
 */
const handlePrismaDuplicateFields = (err) => {
  const target = err.meta?.target || ['data'];
  const field = Array.isArray(target) ? target[0] : target;
  
  const fieldMapping = {
    name: 'Organization name',
    email: 'Work Email',
    phoneNumber: 'Phone Number',
    employeeCode: 'Employee Code',
    payrollBatchId_employeeId: 'Payroll for this employee and month',
    organizationId_employeeCode: 'Employee ID (this code is already taken in your organization)'
  };

  const friendlyField = fieldMapping[field] || (field.charAt(0).toUpperCase() + field.slice(1));
  return new AppError(`Conflict detected: ${friendlyField} already exists.`, 409);
};

const handlePrismaNotFoundError = () => new AppError('The requested record was not found.', 404);

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

/**
 * 404 handler — must be placed after all routes
 */
const notFound = (req, res, next) => {
  next(new AppError(`Cannot find ${req.method} ${req.originalUrl} on this server`, 404));
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err, message: err.message };
  error.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  // Prisma errors
  if (err.code === 'P2002') error = handlePrismaDuplicateFields(err);
  if (err.code === 'P2025') error = handlePrismaNotFoundError();
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  if (process.env.NODE_ENV === 'development') {
    logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method}`, err.stack);
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
      stack: err.stack,
    });
  }

  // Production: don't leak error details
  if (err.isOperational) {
    return res.status(error.statusCode).json({ 
      success: false, 
      message: error.message,
      errors: error.errors
    });
  }

  logger.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({ success: false, message: 'Something went wrong' });
};

module.exports = { notFound, errorHandler };
