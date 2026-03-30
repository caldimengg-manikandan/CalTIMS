'use strict';

const incidentService = require('./incident.service');
const AppError = require('../../shared/utils/AppError');

/**
 * Controller to handle Incident routes
 */
class IncidentController {

    /**
     * Create a new ticket
     * POST /api/v1/incidents
     */
    async createIncident(req, res, next) {
        try {
            const employeeId = req.user?._id || req.user?.id;
            if (!employeeId) {
                return next(new AppError('Authentication failed. User not found.', 401));
            }

            const organizationId = req.organizationId;
            const incident = await incidentService.createIncident(employeeId, req.body, organizationId);

            res.status(201).json({
                success: true,
                message: 'Incident ticket created successfully',
                data: incident,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all tickets with pagination/filters
     * GET /api/v1/incidents
     */
    async getIncidents(req, res, next) {
        try {
            const userId = req.user._id;
            const role = req.user.role;
            const organizationId = req.organizationId;

            const result = await incidentService.getIncidents(userId, role, req.query, organizationId);

            res.status(200).json({
                success: true,
                data: result.incidents,
                pagination: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get single ticket
     * GET /api/v1/incidents/:id
     */
    async getIncident(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user._id;
            const role = req.user.role;
            const organizationId = req.organizationId;

            const incident = await incidentService.getIncidentById(id, userId, role, organizationId);

            res.status(200).json({
                success: true,
                data: incident,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Employee or Admin adds a reply
     * POST /api/v1/incidents/:id/responses
     */
    async addResponse(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user._id;
            const role = req.user.role;
            const organizationId = req.organizationId;

            const incident = await incidentService.addResponse(id, userId, role, req.body.message, organizationId);

            res.status(200).json({
                success: true,
                message: 'Response added successfully',
                data: incident,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Admin updates incident status/assignment
     * PATCH /api/v1/incidents/:id
     */
    async updateIncident(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const userId = req.user._id;
            const role = req.user.role;
            const organizationId = req.organizationId;

            const incident = await incidentService.updateIncident(id, userId, role, updates, organizationId);

            res.status(200).json({
                success: true,
                message: 'Incident updated successfully',
                data: incident,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new IncidentController();
