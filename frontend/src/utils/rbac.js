/**
 * Checks if a user has a specific hierarchical permission.
 * @param {Object} user - The user object from auth store (must contain permissions object)
 * @param {string} module - The top-level module (e.g., 'Payroll')
 * @param {string} submodule - (Optional) The submodule (e.g., 'Payroll Engine')
 * @param {string} action - (Optional) The specific action (e.g., 'run')
 * @returns {boolean} - True if permitted, false otherwise
 */
export const hasPermission = (user, module, submodule, action) => {
  if (!user) return false;

  // Admin bypass
  if (user.role && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'super_admin')) {
    return true;
  }

  const permissions = user.permissions || {};

  // 1. Check Module level
  if (!permissions[module]) {
    return false;
  }

  // If only module is checked, returning true means they have some access to this module
  if (!submodule) {
    return true;
  }

  // 2. Check Submodule level
  if (!permissions[module][submodule]) {
    return false;
  }

  // If only submodule is checked, returning true means they have some access to this submodule
  if (!action) {
    return true;
  }

  // 3. Check Action level
  const allowedActions = permissions[module][submodule];
  if (!Array.isArray(allowedActions)) {
    return false;
  }

  return allowedActions.includes(action);
};
