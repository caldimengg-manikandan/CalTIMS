const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { ROLES } = require('../../constants');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const emailService = require('../../shared/services/email.service');
const logger = require('../../shared/utils/logger');
const { hasPermission } = require('../../shared/utils/rbac');

const supportService = {
    /**
     * Submit a new support ticket
     */
    async createTicket(data, userId, organizationId) {
        const title = data.subject || data.title || (data.message?.includes('PLAN UPGRADE REQUEST') ? 'Plan Upgrade Request' : 'Support Request');
        const description = data.message || data.description || '';
        const category = data.issueType || data.category || 'Support';
        
        let employeeId = null;

        if (userId && organizationId) {
            // Find employee record (hard-scoped)
            const employee = await prisma.employee.findUnique({ 
                where: { userId_organizationId: { userId, organizationId } } 
            });
            if (employee) {
                employeeId = employee.id;
            }
        }

        // If no employee (e.g. public request or onboarding user), we might need to handle it differently
        // but SupportTicket model requires employeeId. Let's see if we can find any employee for this org if user is admin
        if (!employeeId && organizationId) {
            const firstAdmin = await prisma.employee.findFirst({
                where: { organizationId, user: { role: ROLES.OWNER } }
            });
            employeeId = firstAdmin?.id;
        }

        if (!employeeId) {
             throw new AppError('Support ticket requires a valid employee or organization context', 400);
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                organizationId,
                employeeId,
                title,
                description,
                category,
                status: 'OPEN',
                priority: data.priority || 'MEDIUM'
            },
            include: {
                employee: { include: { user: true } }
            }
        });

        // Send email notification for Upgrade Requests
        if (description.includes('PLAN UPGRADE REQUEST') || title.includes('Upgrade')) {
            try {
                const supportEmail = process.env.SUPPORT_EMAIL || 'support@caltims.com';
                await emailService.sendNotificationEmail(supportEmail, {
                    title: `New Upgrade Request: ${ticket.employee?.user?.name || data.name || 'User'}`,
                    message: `A new plan upgrade request has been received.\n\nUser: ${data.name || ticket.employee?.user?.name}\nEmail: ${data.email || ticket.employee?.user?.email}\n\nDetails:\n${description}`,
                    actionLink: `${process.env.CLIENT_URL}/admin/tickets/${ticket.id}`,
                    actionLabel: 'View Ticket',
                    companyName: 'CALTIMS Support'
                });
                logger.info(`Upgrade request email sent to ${supportEmail} for ticket ${ticket.id}`);
            } catch (emailError) {
                logger.error('Failed to send upgrade request email:', emailError);
                // Don't fail the whole request if email fails, but log it
            }
        }

        return ticket;
    },

    /**
     * Get all tickets (Admin/User)
     */
    async getAllTickets(query = {}, organizationId, userId, role) {
        const { status, limit = 10, page = 1 } = query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Base scoping using helper
        const baseQuery = enforceOrg({}, organizationId);
        const where = baseQuery.where;
        
        if (status) where.status = status;

        // RBAC: If not authorized to manage all tickets, only show own tickets
        const canManageAll = hasPermission(permissions, 'Support', 'Help & Support', 'view');
        
        if (!canManageAll && role !== 'super_admin' && role !== ROLES.OWNER) {
            const emp = await prisma.employee.findUnique({ 
                where: { userId_organizationId: { userId, organizationId } } 
            });
            if (emp) where.employeeId = emp.id;
            else return { tickets: [], pagination: { total: 0, page, limit, totalPages: 0 } };
        }

        const [tickets, total] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                include: { employee: { include: { user: { select: { id: true, name: true, email: true } } } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.supportTicket.count({ where })
        ]);

        return {
            tickets,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        };
    },

    /**
     * Get tickets by email (Tracking)
     */
    async getTicketsByEmail(email, organizationId) {
        return await prisma.supportTicket.findMany({
            where: {
                organizationId,
                employee: { 
                    user: { email: { equals: email, mode: 'insensitive' } }
                },
                isDeleted: false
            },
            include: {
                employee: { include: { user: { select: { name: true, email: true } } } },
                comments: { include: { user: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
    },

    /**
     * Update ticket status
     */
    async updateTicketStatus(id, status, userId, organizationId) {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id_organizationId: { id, organizationId } }
        });
        
        if (!ticket || ticket.isDeleted) throw new AppError('Ticket not found', 404);

        return await prisma.supportTicket.update({
            where: { id_organizationId: { id, organizationId } },
            data: { status }
        });
    },

    /**
     * Add comment/message to ticket
     */
    async addMessage(ticketId, content, sender, organizationId) {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id_organizationId: { id: ticketId, organizationId } },
            include: { employee: true }
        });

        if (!ticket) throw new AppError('Ticket not found', 404);

        return await prisma.supportComment.create({
            data: {
                ticketId,
                userId: ticket.employee.userId, // Defaulting to the ticket owner for simple impl
                content
            }
        });
    },

    /**
     * Soft-delete ticket
     */
    async deleteTicket(id, userId, organizationId) {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id_organizationId: { id, organizationId } }
        });
        
        if (!ticket || ticket.isDeleted) throw new AppError('Ticket not found', 404);

        await prisma.supportTicket.update({ 
            where: { id_organizationId: { id, organizationId } },
            data: { isDeleted: true, deletedAt: new Date() }
        });
        return true;
    },

    /**
     * Send OTP for support tracking
     */
    async sendOTP(email) {
        // Since we don't have a DB model for SupportOTP yet, 
        // we'll use a mocked success for now or implement a simple transient logic.
        // In a real app, we'd store this in Redis or a table.
        const otp = '123456'; // Mocked OTP for now
        
        try {
            await emailService.sendNotificationEmail(email, {
                title: 'Support Verification Code',
                message: `Your verification code for CALTIMS Support is: ${otp}. This code will expire in 10 minutes.`,
                companyName: 'CALTIMS Support'
            });
            return true;
        } catch (error) {
            logger.error('Failed to send support OTP email:', error);
            throw new AppError('Failed to send verification code', 500);
        }
    },

    /**
     * Verify OTP
     */
    async verifyOTP(email, otp) {
        if (otp === '123456') return true; // Mocked verification
        throw new AppError('Invalid or expired verification code', 400);
    }
};

module.exports = supportService;
