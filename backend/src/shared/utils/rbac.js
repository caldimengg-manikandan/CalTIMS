'use strict';

/**
 * Utility to check if a user has a specific permission based on the hierarchical structure.
 * Structure: { Module: { Submodule: { Action: true/false } } }
 * 
 * @param {Object} permissions - The user's permissions object from the database
 * @param {string} module - The module name (e.g., 'Payroll')
 * @param {string} submodule - The submodule name (e.g., 'Payroll Engine')
 * @param {string} action - The action (e.g., 'view', 'edit', 'delete')
 * @returns {boolean}
 */
const hasPermission = (permissions, module, submodule, action) => {
  if (!permissions) return false;
  
  // Super Admin / Owner bypass logic (handled in context, but good for safety)
  if (permissions._isSuperAdmin || permissions._isOwner) return true;

  const mod = permissions[module];
  if (!mod) return false;

  const sub = mod[submodule];
  if (!sub) return false;

  return sub[action] === true;
};

module.exports = { hasPermission };
