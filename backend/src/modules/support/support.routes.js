'use strict';

const express = require('express');
const supportController = require('./support.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

const router = express.Router();

// Public routes to submit a support ticket
router.post('/send-otp', supportController.sendOTP);
router.post('/verify-otp', supportController.verifyOTP);
router.post('/tickets', supportController.createTicket);
router.post('/track-tickets', supportController.getMyTickets);
router.post('/tickets/:id/messages', supportController.addTicketMessage);

// Protected routes - Admin only
router.use(authenticate);
router.use(authorize('admin'));

router
    .route('/tickets')
    .get(supportController.getAllTickets);

router
    .route('/tickets/:id')
    .get(supportController.getTicket)
    .patch(supportController.updateTicketStatus)
    .delete(supportController.deleteTicket);

module.exports = router;
