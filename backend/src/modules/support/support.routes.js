'use strict';

const express = require('express');
const supportController = require('./support.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');

const router = express.Router();

// ─── Public Routes (No authentication required, but uses OTP) ────────────────
// These are used from the login page Support Modal
router.post('/send-otp', supportController.sendOTP);
router.post('/verify-otp', supportController.verifyOTP);
router.post('/tickets', supportController.submitTicket);
router.post('/track-tickets', supportController.trackTickets);
router.post('/tickets/:id/messages', supportController.addTicketMessage);

// ─── Admin/Manager Routes (Authentication required) ──────────────────────────
router.use(authenticate);

// GET /api/v1/support/tickets - View all tickets
router.get('/tickets', authorize('admin', 'manager'), supportController.getTickets);

// PATCH /api/v1/support/tickets/:id - Update status
router.patch('/tickets/:id', authorize('admin', 'manager'), supportController.updateTicketStatus);

// DELETE /api/v1/support/tickets/:id - Remove ticket
router.delete('/tickets/:id', authorize('admin', 'manager'), supportController.deleteTicket);

module.exports = router;
