'use strict';

const { HTTP_STATUS } = require('../../constants');

/**
 * Standard API response wrapper
 */
class ApiResponse {
  static success(res, { message = 'Success', data = null, statusCode = HTTP_STATUS.OK, pagination = null } = {}) {
    const response = { success: true, message, data };
    if (pagination) response.pagination = pagination;
    return res.status(statusCode).json(response);
  }

  static created(res, { message = 'Created successfully', data = null } = {}) {
    return res.status(HTTP_STATUS.CREATED).json({ success: true, message, data });
  }

  static error(res, { message = 'An error occurred', statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors = null } = {}) {
    const response = { success: false, message };
    if (errors) response.errors = errors;
    return res.status(statusCode).json(response);
  }

  static notFound(res, message = 'Resource not found') {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message });
  }

  static unauthorized(res, message = 'Unauthorized') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message });
  }

  static forbidden(res, message = 'Access denied') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message });
  }

  static badRequest(res, message = 'Bad request', errors = null) {
    const response = { success: false, message };
    if (errors) response.errors = errors;
    return res.status(HTTP_STATUS.BAD_REQUEST).json(response);
  }
}

module.exports = ApiResponse;
