/**
 * Checks if a user has a specific hierarchical permission.
 * @param {Object} user - The user object from auth store (must contain permissions object)
 * @param {string} module - The top-level module (e.g., 'Payroll')
 * @param {string} submodule - (Optional) The submodule (e.g., 'Payroll Engine')
 * @param {string} action - (Optional) The specific action (e.g., 'run')
 * @returns {boolean} - True if permitted, false otherwise
 */

const PRIVILEGED_ROLES = ['admin', 'super_admin', 'owner'];

export const isSuperAdmin = (user) => {
  if (!user) return false;
  return PRIVILEGED_ROLES.includes((user.role || '').toLowerCase()) || user.isOwner;
};

export const hasFullAccess = (user) => {
  if (!user) return false;
  return isSuperAdmin(user) || user.permissions?.__full_access__ || user.permissions?.all;
};

export const canAccessModule = (user, module) => {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  
  const rawPermissions = user.permissions || {};
  const moduleKey = Object.keys(rawPermissions).find(k => k.toLowerCase() === module.toLowerCase()) || 
                    Object.keys(rawPermissions).find(k => k.toLowerCase() === 'all');
  
  return !!moduleKey;
};

export const hasPermission = (user, module, submodule, action) => {
  if (!user) return false;

  // 1. Privileged role bypass — these roles see everything
  const userRole = (user.role || '').toLowerCase();
  if (PRIVILEGED_ROLES.includes(userRole) || user.isOwner) {
    return true;
  }

  // 2. Normalize permissions object
  const rawPermissions = user.permissions || {};

  // Full-access marker from backend (for privileged roles without granular RBAC rows)
  if (rawPermissions.__full_access__) return true;

  // Case-insensitive module lookup
  const moduleKey = Object.keys(rawPermissions).find(k => k.toLowerCase() === module.toLowerCase()) || 
                    Object.keys(rawPermissions).find(k => k.toLowerCase() === 'all');
  
  if (!moduleKey) return false;
  
  const modulePermissions = rawPermissions[moduleKey];

  // If it's a flat array of actions [ 'view', 'edit' ]
  if (Array.isArray(modulePermissions)) {
    if (!action) return true; // Has some access to module
    const normalizedAction = action.toLowerCase();
    return modulePermissions.some(a => 
      a.toLowerCase() === normalizedAction || 
      a.toLowerCase() === 'all' || 
      a.toLowerCase() === '*'
    );
  }

  // If only module is checked, returning true means they have some access to this module
  if (!submodule) return true;

  // 3. Submodule level check (Nested structure)
  if (typeof modulePermissions !== 'object' || modulePermissions === null) return false;

  const submoduleKey = Object.keys(modulePermissions).find(k => k.toLowerCase() === submodule.toLowerCase()) || 
                       Object.keys(modulePermissions).find(k => k.toLowerCase() === 'all');

  if (!submoduleKey) return false;

  const allowedActions = modulePermissions[submoduleKey];

  // If only submodule level check is requested
  if (!action) return true;

  // 4. Action level check
  if (!Array.isArray(allowedActions)) {
    // Handle 'all' as a string if it's not an array
    if (typeof allowedActions === 'string') {
      const normalized = allowedActions.toLowerCase();
      return normalized === 'all' || normalized === '*';
    }
    return false;
  }

  const normalizedAction = action.toLowerCase();
  return allowedActions.some(a => 
    a.toLowerCase() === normalizedAction || 
    a.toLowerCase() === 'all' || 
    a.toLowerCase() === '*'
  );
};
