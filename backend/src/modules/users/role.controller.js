'use strict';

const Role = require('./role.model');

const getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 });
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
    const role = await Role.create(req.body);
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
