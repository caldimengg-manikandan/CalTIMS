'use strict';

const Role = require('./role.model');

const getAllRoles = async (req, res, next) => {
  try {
    // Only fetch roles for the user's organization
    const roles = await Role.find({ organizationId: req.organizationId }).sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    // Inject organization ID from the authenticated user
    const roleData = {
      ...req.body,
      organizationId: req.organizationId
    };
    
    const role = await Role.create(roleData);
    res.status(201).json({
      success: true,
      data: role
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllRoles,
  createRole
};
