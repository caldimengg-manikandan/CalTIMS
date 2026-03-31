'use strict';

const crypto = require('crypto');
const { OTP, SupportTicket } = require('./support.model');
const emailService = require('../../shared/services/email.service');
const AppError = require('../../shared/utils/AppError');
const notifier = require('../../shared/services/notifier');
const User = require('../users/user.model');
const { ROLES } = require('../../constants');
const { logAction } = require('../audit/audit.routes');

const supportService = {
    /**
     * Generate and send OTP via email
     */
    async sendOTP(email) {
        if (!email) throw new AppError('Email is required', 400);

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save to DB (upsert)
        await OTP.findOneAndUpdate(
            { email },
            { otp, expiresAt },
            { upsert: true, new: true }
        );

        // Send Email
        try {
            await emailService.sendNotificationEmail(email, {
                title: 'Your Verification Code',
                message: `Your verification code for CALTIMS Support is: <strong>${otp}</strong>. This code will expire in 10 minutes.`,
                companyName: 'CALTIMS Support'
            });
        } catch (error) {
            console.error('Email send error:', error);
            // In development, we might not have SMTP configured, but for now we continue
            if (process.env.NODE_ENV === 'production') {
                throw new AppError('Failed to send verification email. Please try again later.', 500);
            }
        }

        return true;
    },

    /**
     * Verify OTP
     */
    async verifyOTP(email, otp) {
        if (!email || !otp) throw new AppError('Email and OTP are required', 400);

        const record = await OTP.findOne({ email, otp });
        if (!record) {
            throw new AppError('Invalid or expired verification code', 400);
        }

        // Delete used OTP
        await OTP.deleteOne({ _id: record._id });

        return true;
    },

    /**
     * Submit a new support ticket
     */
    async createTicket(data, requestorId, organizationId) {
        let finalOrgId = organizationId;
        
        // Try to find organization via email if not provided
        if (!finalOrgId && data.email) {
            const user = await User.findOne({ email: data.email.toLowerCase() });
            if (user) {
                finalOrgId = user.organizationId;
            }
        }

        const ticket = await SupportTicket.create({ ...data, organizationId: finalOrgId });
        
        // Notify User via email
        try {
            await emailService.sendNotificationEmail(ticket.email, {
                title: 'Support Request Received',
                message: `Hello ${ticket.name},<br><br>Your support request (#${ticket.ticketId}) for "${ticket.issueType}" has been successfully logged. Our team will review your request and get back to you shortly.<br><br>Details:<br>${ticket.message}`,
                companyName: 'CALTIMS Support'
            });
        } catch (error) {
            console.error('Failed to send ticket confirmation email to user:', error);
        }

        // Notify Admins of the SAME organization
        try {
            const admins = await User.find({ role: ROLES.ADMIN, isActive: true, organizationId }).select('_id email');
            const notificationPromises = admins.map(admin =>
                notifier.send(admin._id, {
                    userEmail: admin.email,
                    type: 'support_ticket_created',
                    title: 'New Support Ticket',
                    message: `A new support ticket (#${ticket.ticketId}) has been raised by ${ticket.name} (${ticket.email}). Type: ${ticket.issueType}`,
                    refId: ticket._id,
                    refModel: 'Support',
                    organizationId,
                })
            );
            await Promise.all(notificationPromises);
        } catch (err) {
            console.error('Failed to notify admins about support ticket:', err);
        }

        if (requestorId) {
            logAction({
                userId: requestorId,
                action: 'CREATE_SUPPORT_TICKET',
                entityType: 'Support',
                entityId: ticket._id,
                details: { subject: ticket.subject, category: ticket.category },
                organizationId
            });
        }

        return ticket;
    },

    /**
     * Get tickets by email
     */
    async getTicketsByEmail(email, organizationId) {
        if (!email) throw new AppError('Email is required', 400);
        const filter = { email };
        if (organizationId) {
            filter.organizationId = organizationId;
        }

        const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 });
        return tickets;
    },

    /**
     * Get all tickets (Admin)
     */
    async getAllTickets(query = {}, organizationId) {
        const { status, limit = 10, page = 1 } = query;
        const filter = {};
        if (organizationId) filter.organizationId = organizationId;
        if (status) filter.status = status;

        const tickets = await SupportTicket.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await SupportTicket.countDocuments(filter);

        return {
            tickets,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    },

    /**
     * Update ticket status
     */
    async updateTicketStatus(id, status, requestorId, organizationId) {
        const ticket = await SupportTicket.findOneAndUpdate({ _id: id, organizationId }, { status }, { new: true });
        if (!ticket) throw new AppError('Ticket not found', 404);

        // Notify User via email
        try {
            const Settings = require('../settings/settings.model');
            const settings = await Settings.findOne({ organizationId }).lean();
            const companyName = settings?.organization?.companyName || 'CALTIMS';

            await emailService.sendNotificationEmail(ticket.email, {
                title: `Support Ticket Updated: ${status.toUpperCase()}`,
                message: `Your support ticket (#${ticket.ticketId}) subject "${ticket.subject}" has been updated to status: <strong>${status}</strong>.`,
                companyName: `${companyName} Support`
            });
        } catch (error) {
            console.error('Failed to send ticket status update email:', error);
        }

        logAction({
            userId: requestorId,
            action: 'UPDATE_TICKET_STATUS',
            entityType: 'Support',
            entityId: id,
            details: { status, ticketId: ticket.ticketId },
            organizationId
        });

        return ticket;
    },

    /**
     * Add message to ticket
     */
    async addMessage(id, message, sender, organizationId) {
        const ticket = await SupportTicket.findOne({ _id: id, organizationId });
        if (!ticket) throw new AppError('Ticket not found', 404);

        ticket.responses.push({ message, sender });
        await ticket.save();
        return ticket;
    },

    /**
     * Delete ticket
     */
    async deleteTicket(id, requestorId, organizationId) {
        const ticket = await SupportTicket.findOne({ _id: id, organizationId });
        if (!ticket) throw new AppError('Ticket not found', 404);

        await SupportTicket.findOneAndDelete({ _id: id, organizationId });

        logAction({
            userId: requestorId,
            action: 'DELETE_SUPPORT_TICKET',
            entityType: 'Support',
            entityId: id,
            details: { ticketId: ticket.ticketId, subject: ticket.subject },
            organizationId
        });

        return true;
    }
};

module.exports = supportService;
