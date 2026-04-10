/**
 * Prisma Helper Utilities
 * Enforces organizational isolation and consistent query patterns.
 */

/**
 * Enforces organizationId on Prisma query objects.
 * Prevents accidental cross-tenant data leakage.
 * 
 * @param {Object} query - The Prisma query object (containing where, include, etc.)
 * @param {String} organizationId - The tenant's organization ID
 * @returns {Object} Scoped query object
 */
function enforceOrg(query = {}, organizationId) {
  if (!organizationId) {
    throw new Error('Critical Security Error: organizationId is required for this query.');
  }

  return {
    ...query,
    where: {
      ...query.where,
      organizationId,
    }
  };
}

/**
 * Helper to handle soft deletes specifically.
 * Use this when you need only the soft-delete filter without org-scoping (rare).
 */
function activeOnly(where = {}) {
  return {
    ...where,
    isDeleted: false
  };
}

/**
 * Transforms a generic repository query to be tenant-aware.
 * Use in services or controllers.
 */
const dbGuard = (orgId) => ({
  scope: (query) => enforceOrg(query, orgId),
  active: activeOnly
});

module.exports = {
  enforceOrg,
  activeOnly,
  dbGuard
};
