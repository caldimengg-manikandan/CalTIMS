'use strict';

const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  INTERN: 'intern',
  HR: 'hr',
  FINANCE: 'finance',
});

const TIMESHEET_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FROZEN: 'FROZEN',
  ADMIN_FILLED: 'ADMIN_FILLED',
});

const LEAVE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

const LEAVE_TYPES = Object.freeze({
  ANNUAL: 'annual',
  SICK: 'sick',
  CASUAL: 'casual',
  LOP: 'lop',
});

const PROJECT_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ON_HOLD: 'on-hold',
});

const ANNOUNCEMENT_TYPES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  URGENT: 'urgent',
});

const CALENDAR_EVENT_TYPES = Object.freeze({
  HOLIDAY: 'holiday',
  COMPANY_EVENT: 'company_event',
  LEAVE: 'leave',
  PERSONAL_EVENT: 'personal_event',
});

const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
});

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 5000,
});

const { ROLE_PERMISSIONS } = require('./rolePermissions');

module.exports = {
  ROLES,
  TIMESHEET_STATUS,
  LEAVE_STATUS,
  LEAVE_TYPES,
  PROJECT_STATUS,
  ANNOUNCEMENT_TYPES,
  CALENDAR_EVENT_TYPES,
  HTTP_STATUS,
  PAGINATION,
  ROLE_PERMISSIONS,
};
