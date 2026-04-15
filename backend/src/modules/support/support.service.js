const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const { ROLES } = require('../../constants');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const emailService = require('../../shared/services/email.service');
const logger = require('../../shared/utils/logger');
const { hasPermission } = require('../../shared/utils/rbac');

const otpService = require('../../shared/services/otp.service');

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

        // Auto-resolve employee context for public tickets using email
        if (!employeeId && data.email) {
            const userRef = await prisma.user.findUnique({
                where: { email: data.email },
                include: { employee: true }
            });

            if (userRef && userRef.employee) {
                const empInfo = Array.isArray(userRef.employee) ? userRef.employee[0] : userRef.employee;
                if (empInfo) {
                    employeeId = empInfo.id;
                    if (!organizationId) {
                        organizationId = empInfo.organizationId || userRef.organizationId;
                    }
                }
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

        if (!employeeId || !organizationId) {
             throw new AppError('Support ticket requires a registered email address associated with an organization', 400);
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

        const total = await prisma.supportTicket.count({ where: { organizationId } });
        return {
            ...ticket,
            ticketId: `SUP-${(total).toString().padStart(4, '0')}`
        };
    },

    /**
     * Get all tickets (Admin/User)
     */
    async getAllTickets(query = {}, organizationId, userId, role, permissions = []) {
        const { status, limit = 10, page = 1, search } = query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Base scoping using helper
        const baseQuery = enforceOrg({}, organizationId);
        const where = baseQuery.where;
        
        if (status && status !== 'All') where.status = status;

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { employee: { user: { name: { contains: search, mode: 'insensitive' } } } },
                { employee: { user: { email: { contains: search, mode: 'insensitive' } } } }
            ];
        }

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
                include: { 
                    employee: { include: { user: { select: { id: true, name: true, email: true } } } },
                    comments: { include: { user: { select: { name: true, role: true } } } }
                },
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
            where: { id: ticketId },
            include: { 
                employee: { include: { user: true } },
                comments: { include: { user: true } }
            }
        });

        if (!ticket) throw new AppError('Ticket not found', 404);

        let finalUserId = ticket.employee.userId;

        if (sender === 'admin') {
            const adminUser = await prisma.user.findFirst({
                where: { OR: [{ role: 'super_admin' }, { isOwner: true }] }
            });
            if (adminUser) finalUserId = adminUser.id;

            if (ticket.employee?.user?.email) {
                try {
                    const ticketNum = ticket.id.split('-')[0].toUpperCase();
                    
                    // Build thread context for email
                    let threadHtml = '';
                    const sortedComments = [...(ticket.comments || [])].sort((a, b) => 
                        new Date(b.createdAt) - new Date(a.createdAt)
                    );
                    
                    if (sortedComments.length > 0) {
                        threadHtml = '<br><div style="border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 10px;"><p style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">Recent Activity:</p>';
                        sortedComments.slice(0, 3).forEach(c => {
                            const isAgent = c.user?.role === 'admin' || c.user?.role === 'owner';
                            threadHtml += `
                                <div style="margin-bottom: 12px; font-size: 13px;">
                                    <span style="color: ${isAgent ? '#4f46e5' : '#64748b'}; font-weight: 700;">${isAgent ? 'Agent' : ticket.employee.user.name}:</span>
                                    <span style="color: #334155;">${c.content}</span>
                                </div>`;
                        });
                        threadHtml += '</div>';
                    }

                    await emailService.sendNotificationEmail(ticket.employee.user.email, {
                        title: `Update on Support Ticket [SUP-${ticketNum}]`,
                        message: `
                            <div style="text-align: left;">
                                <p>Hello ${ticket.employee.user.name},</p>
                                <p>Your support ticket regarding "<b>${ticket.title}</b>" has received a new response:</p>
                                <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #4f46e5; margin: 20px 0;">
                                    <p style="margin: 0; font-weight: 500; color: #1e293b; line-height: 1.6;">${content}</p>
                                </div>
                                ${threadHtml}
                                <p style="margin-top: 25px; font-size: 14px; color: #64748b;">You can view the full thread and respond by logging into your support portal.</p>
                            </div>`,
                        actionLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`,
                        actionLabel: 'Go to Support Portal'
                    });
                } catch (e) {
                    logger.error('Failed to send support email:', e);
                }
            }
        }

        return await prisma.supportComment.create({
            data: {
                ticketId,
                userId: finalUserId,
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

    async sendOTP(email) {
        return await otpService.sendOTP(email, 'Support Verification');
    },

    async verifyOTP(email, otp) {
        return await otpService.verifyOTP(email, otp);
    }
};

module.exports = supportService;
