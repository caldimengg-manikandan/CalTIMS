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
            const incident = await incidentService.createIncident(req.context, req.body);

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
            const result = await incidentService.getIncidents(req.context, req.query);

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
            const incident = await incidentService.getIncidentById(req.params.id, req.context);

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
            const incident = await incidentService.addResponse(req.params.id, req.context, req.body.message);

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
            const incident = await incidentService.updateIncident(req.params.id, req.context, req.body);

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
