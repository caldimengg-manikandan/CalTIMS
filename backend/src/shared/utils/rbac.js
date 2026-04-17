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
  
  // Super Admin / Owner bypass logic
  if (permissions.all === true || (permissions.all && permissions.all.all && permissions.all.all.includes('all'))) {
    return true;
  }

  const mod = permissions[module] || permissions['all'];
  if (!mod) return false;

  const sub = mod[submodule] || mod['all'];
  if (!sub) return false;

  // Handle both boolean true and array of permitted actions
  if (Array.isArray(sub)) {
    return sub.includes(action) || sub.includes('all');
  }
  
  return sub[action] === true || sub['all'] === true;
};

module.exports = { hasPermission };
