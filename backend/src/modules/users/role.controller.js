'use strict';

const { prisma } = require('../../config/database');

const getAllRoles = async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
};

const createRole = async (req, res, next) => {
  try {
    const role = await prisma.role.create({
      data: {
        name: req.body.name,
        organizationId: req.organizationId,
        permissions: req.body.permissions || {},
        description: req.body.description || null,
        isSystem: req.body.isSystem || false,
      },
    });
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllRoles, createRole };
