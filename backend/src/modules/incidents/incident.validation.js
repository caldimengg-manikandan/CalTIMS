'use strict';

const Joi = require('joi');

const createIncidentSchema = Joi.object({
    title: Joi.string().trim().max(100).required(),
    description: Joi.string().trim().max(2000).required(),
    category: Joi.string()
        .valid('timesheet error', 'project missing', 'incorrect hours', 'leave conflict', 'general help')
        .required(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Medium'),
    relatedTimesheet: Joi.string().hex().length(24).optional().allow(null, ''),
    attachments: Joi.array().items(Joi.string().uri()).optional(),
});

const incidentIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required(),
});

const updateIncidentAdminSchema = Joi.object({
    status: Joi.string().valid('Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Withdrawn').optional(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').optional(),
    assignedTo: Joi.string().hex().length(24).optional().allow(null, ''),
}).min(1);

const addResponseSchema = Joi.object({
    message: Joi.string().trim().required(),
});

module.exports = {
    createIncidentSchema,
    incidentIdParamSchema,
    updateIncidentAdminSchema,
    addResponseSchema,
};

