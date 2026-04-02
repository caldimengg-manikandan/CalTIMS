'use strict';

const AppError = require('../shared/utils/AppError');
const logger = require('../shared/utils/logger');
const { HTTP_STATUS } = require('../constants');

/**
 * Handle specific Mongoose / JWT error types
 */
const handleCastErrorDB = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);
const handleDuplicateFieldsDB = (err) => {
  // Try to get the field from keyValue (Mongoose) or error message (Native Mongo)
  let field = 'data';
  let value = 'unknown';

  if (err.keyValue) {
    field = Object.keys(err.keyValue)[0];
    value = err.keyValue[field];
  } else if (err.errmsg) {
    // Fallback for native driver error messages
    const match = err.errmsg.match(/index: (.+)_1/);
    if (match) field = match[1];
  }

  // Prettify common field names
  const fieldMapping = {
    name: 'Organization name',
    email: 'Work Email',
    phoneNumber: 'Phone Number'
  };

  const friendlyField = fieldMapping[field] || (field.charAt(0).toUpperCase() + field.slice(1));

  return new AppError(`Conflict detected: ${friendlyField} '${value}' is already registered or taken.`, 409);
};
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${errors.join('. ')}`, 400);
};
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

  // Mongoose errors
  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  // JWT errors
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  if (process.env.NODE_ENV === 'development') {
    logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method}`, err.stack);
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      stack: err.stack,
    });
  }

  // Production: don't leak error details
  if (err.isOperational) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  logger.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({ success: false, message: 'Something went wrong' });
};

module.exports = { notFound, errorHandler };
