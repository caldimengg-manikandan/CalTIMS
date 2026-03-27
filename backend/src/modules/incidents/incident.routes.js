'use strict';

const express = require('express');
const incidentController = require('./incident.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { validate, validateParams } = require('../../middleware/validate.middleware');
const { createIncidentSchema, updateIncidentAdminSchema, addResponseSchema, incidentIdParamSchema } = require('./incident.validation');

const { checkSubscription, requireFeature } = require('../../middleware/subscription.middleware');

const router = express.Router();

// All incident routes require authentication and active subscription
router.use(authenticate);
router.use(checkSubscription);
router.use(requireFeature('support'));

// ─── Shared Routes (Employee & Admin) ────────────────────────────────────────
// GET /api/v1/incidents - Lists tickets (Employees see own, Admins see all)
router.get('/', incidentController.getIncidents);

// POST /api/v1/incidents - Create a new ticket
router.post('/', validate(createIncidentSchema), incidentController.createIncident);

// GET /api/v1/incidents/:id - View specific ticket
router.get('/:id', incidentController.getIncident);

// POST /api/v1/incidents/:id/responses - Add a reply to the ticket string
router.post(
    '/:id/responses',
    validateParams(incidentIdParamSchema),
    validate(addResponseSchema),
    incidentController.addResponse
);

// ─── Admin Only Routes ───────────────────────────────────────────────────────
// PATCH /api/v1/incidents/:id - Update status / assignment / priority
router.patch(
    '/:id',
    validateParams(incidentIdParamSchema),
    validate(updateIncidentAdminSchema),
    incidentController.updateIncident
);

module.exports = router;
