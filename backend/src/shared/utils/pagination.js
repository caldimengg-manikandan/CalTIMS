'use strict';

const { PAGINATION } = require('../../constants');

/**
 * Parse and validate pagination params from query string
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build pagination metadata for response
 */
const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

/**
 * Build a sort object from query string, e.g. sortBy=createdAt&sortOrder=desc
 */
const buildSort = (query, defaultSort = { createdAt: -1 }) => {
  const { sortBy, sortOrder } = query;
  if (!sortBy) return defaultSort;
  return { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
};

module.exports = { parsePagination, buildPaginationMeta, buildSort };
