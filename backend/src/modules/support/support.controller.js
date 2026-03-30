'use strict';

const supportService = require('./support.service');

const sendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;
        await supportService.sendOTP(email);
        res.status(200).json({
            success: true,
            message: 'Verification code sent'
        });
    } catch (error) {
        next(error);
    }
};

const verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        await supportService.verifyOTP(email, otp);
        res.status(200).json({
            success: true,
            message: 'OTP verified successfully'
        });
    } catch (error) {
        next(error);
    }
};

const submitTicket = async (req, res, next) => {
    try {
        const organizationId = req.organizationId || req.body.organizationId;
        const ticket = await supportService.createTicket(req.body, req.user?._id, organizationId);
        res.status(201).json({
            success: true,
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

const trackTickets = async (req, res, next) => {
    try {
        const { email, organizationId } = req.body;
        const orgId = organizationId || req.organizationId;
        const tickets = await supportService.getTicketsByEmail(email, orgId);
        res.status(200).json({
            success: true,
            data: { tickets }
        });
    } catch (error) {
        next(error);
    }
};

const getTickets = async (req, res, next) => {
    try {
        const organizationId = req.organizationId;
        const result = await supportService.getAllTickets(req.query, organizationId);
        res.status(200).json({
            success: true,
            data: result.tickets,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

const updateTicketStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const organizationId = req.organizationId;
        const ticket = await supportService.updateTicketStatus(id, status, req.user?._id, organizationId);
        res.status(200).json({
            success: true,
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

const addTicketMessage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, sender, organizationId } = req.body;
        const orgId = organizationId || req.organizationId;
        const ticket = await supportService.addMessage(id, message, sender, orgId);
        res.status(200).json({
            success: true,
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

const deleteTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId;
        await supportService.deleteTicket(id, req.user?._id, organizationId);
        res.status(200).json({
            success: true,
            message: 'Ticket deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendOTP,
    verifyOTP,
    submitTicket,
    trackTickets,
    getTickets,
    updateTicketStatus,
    addTicketMessage,
    deleteTicket
};
