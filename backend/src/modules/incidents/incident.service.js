const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const notificationService = require('../notifications/notification.service');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const { hasPermission } = require('../../shared/utils/rbac');
const { ROLES } = require('../../constants');

/**
 * Service to handle Incident operations via Prisma
 */
class IncidentService {
    /**
     * Creates a new incident ticket and notifies admins.
     */
    async createIncident(context, data) {
        const { organizationId, userId } = context;
        
        // Find employee record for this user (hard-scoped)
        let employee = await prisma.employee.findUnique({
            where: { userId_organizationId: { userId, organizationId } }
        });
        
        if (!employee) {
            // Identity Healing: Create missing employee record for administrative users
            const lastEmp = await prisma.employee.findFirst({
                where: { organizationId },
                orderBy: { employeeCode: 'desc' },
                select: { employeeCode: true }
            });
            
            let nextNumber = 1;
            if (lastEmp && lastEmp.employeeCode) {
                const match = lastEmp.employeeCode.match(/\d+$/);
                if (match) nextNumber = parseInt(match[0]) + 1;
            }
            const employeeCode = `EMP-${nextNumber.toString().padStart(4, '0')}`;
    
            employee = await prisma.employee.create({
                data: {
                    userId,
                    organizationId,
                    employeeCode,
                    status: 'ACTIVE',
                    joiningDate: new Date()
                }
            });
        }

        const count = await prisma.incident.count({ where: { organizationId } });
        const incidentIdStr = `INC-${(count + 1).toString().padStart(4, '0')}`;

        const incident = await prisma.incident.create({
            data: {
                incidentId: incidentIdStr,
                organizationId,
                employeeId: employee.id,
                title: data.title,
                description: data.description,
                category: data.category,
                priority: data.priority || 'Medium',
                status: 'Open',
                attachments: data.attachments || [],
            },
            include: { employee: { include: { user: { select: { name: true } } } } }
        });
 
        // Notify admins about the new incident
        await this._notifyAdminsAboutNewIncident(incident, context);
 
        return incident;
    }
 
    /**
     * Helper function to notify all active admins/managers about a new INC.
     */
    async _notifyAdminsAboutNewIncident(incident, context) {
        const { organizationId, userId: reporterUserId } = context;
        
        const reporter = await prisma.user.findUnique({ 
            where: { id_organizationId: { id: reporterUserId, organizationId } },
            select: { name: true }
        });
        const reporterName = reporter ? reporter.name : 'An employee';
 
        const message = `${reporterName} has raised a new ${incident.priority} priority incident (${incident.incidentId}) regarding '${incident.category}'.`;
 
        // Notify users with Support > Help & Support > edit permission
        const allUsers = await prisma.user.findMany({ 
            where: { 
                isActive: true, 
                organizationId,
                isDeleted: false
            },
            include: { roleRef: true }
        });

        const adminsToNotify = allUsers.filter(u => {
            if (u.role === 'super_admin' || u.isOwner) return true;
            return hasPermission(u.roleRef?.permissions, 'Support', 'Help & Support', 'edit');
        });

        const adminIds = adminsToNotify.map(a => a.id);
 
        if (adminIds.length > 0) {
            await Promise.all(adminIds.map(adminId => 
                notificationService.create({
                    userId: adminId,
                    organizationId,
                    title: 'New Incident Ticket Raised',
                    message,
                    type: 'incident_created',
                    refId: incident.id,
                    refModel: 'Incident'
                })
            ));
        }
    }
 
    /**
     * Returns a paginated/filtered list of incidents.
     */
    async getIncidents(context, queryParams = {}) {
        const { organizationId, userId, permissions, role: userRole } = context;
        const { status, priority, category, search, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = queryParams;
 
        // Base scoping using helper
        const baseQuery = enforceOrg({}, organizationId);
        const where = baseQuery.where;
 
        const canViewAll = hasPermission(permissions, 'Support', 'Help & Support', 'view');

        // RBAC: If cannot view all, only see their own
        if (!canViewAll && !context.isSuperAdmin && !context.isOwner) {
            const employee = await prisma.employee.findUnique({ 
                where: { userId_organizationId: { userId, organizationId } } 
            });
            if (employee) where.employeeId = employee.id;
            else return { incidents: [], pagination: { total: 0, page, limit, totalPages: 0 } };
        }
 
        // Apply optional filters
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (category) where.category = category;
 
        // Apply search
        if (search) {
            where.OR = [
                { incidentId: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } }
            ];
        }
 
        const skip = (Number(page) - 1) * Number(limit);
 
        const [total, incidents] = await Promise.all([
            prisma.incident.count({ where }),
            prisma.incident.findMany({
                where,
                include: {
                    employee: { include: { user: { select: { id: true, name: true, email: true } } } },
                    assignedTo: { include: { user: { select: { id: true, name: true } } } }
                },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: Number(limit)
            })
        ]);
 
        return {
            incidents,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }
 
    /**
     * Retrieves a single incident by ID. Checks RBAC.
     */
    async getIncidentById(incidentId, context) {
        const { organizationId, userId, role: userRole } = context;
        
        const incident = await prisma.incident.findUnique({
            where: { id_organizationId: { id: incidentId, organizationId } },
            include: {
                employee: { include: { user: { select: { id: true, name: true, email: true } } } },
                assignedTo: { include: { user: { select: { name: true, email: true } } } }
            }
        });
 
        if (!incident || incident.isDeleted) {
            throw new AppError('Incident not found', 404);
        }
 
        // RBAC check
        const canViewAll = hasPermission(context.permissions, 'Support', 'Help & Support', 'view');
        if (!canViewAll && !context.isSuperAdmin && !context.isOwner && incident.employee.user.id !== userId) {
            throw new AppError('Incident not found', 404);
        }
 
        return incident;
    }
 
    /**
     * Add a response to an existing incident ticket.
     */
    async addResponse(incidentId, context, message) {
        const { organizationId, userId, role: userRole } = context;
        
        const incident = await prisma.incident.findUnique({ 
            where: { id_organizationId: { id: incidentId, organizationId } },
            include: { employee: true }
        });
 
        if (!incident || incident.isDeleted) throw new AppError('Incident not found', 404);
 
        const canEditAll = hasPermission(context.permissions, 'Support', 'Help & Support', 'edit');
        if (!canEditAll && !context.isSuperAdmin && !context.isOwner) {
            const emp = await prisma.employee.findUnique({ 
                where: { userId_organizationId: { userId, organizationId } } 
            });
            if (!emp || incident.employeeId !== emp.id) {
                throw new AppError('Incident not found', 404);
            }
        }
 
        if (incident.status === 'Closed') {
            throw new AppError('Cannot reply to a closed incident.', 400);
        }
 
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, role: true }
        });

        const responses = Array.isArray(incident.responses) ? incident.responses : [];
        const newResponse = {
            message,
            user,
            createdAt: new Date(),
        };
        responses.push(newResponse);
 
        const updateData = { responses };
 
        // Auto status update:
        // If Support Agent/Admin replies to Open ticket -> In Progress
        if (canEditAll && incident.status === 'Open') {
            updateData.status = 'In Progress';
        }
 
        const updatedIncident = await prisma.incident.update({
            where: { id_organizationId: { id: incident.id, organizationId } },
            data: updateData
        });
 
        // Notify the other party
        if (canEditAll) {
             const reporterEmployee = await prisma.employee.findUnique({
                where: { id: incident.employeeId },
                include: { user: true }
             });
             if (reporterEmployee?.userId) {
                await notificationService.create({
                    userId: reporterEmployee.userId,
                    organizationId,
                    title: 'Update on your Incident',
                    message: `An admin replied to your ticket ${incident.incidentId}.`,
                    type: 'incident_response',
                    refId: incident.id,
                    refModel: 'Incident'
                });
             }
        } else {
            if (incident.assignedToId) {
                const assignedEmployee = await prisma.employee.findUnique({
                    where: { id: incident.assignedToId },
                    select: { userId: true }
                });
                if (assignedEmployee) {
                    await notificationService.create({
                        userId: assignedEmployee.userId,
                        organizationId,
                        title: 'New Reply on Assigned Incident',
                        message: `An employee replied to ticket ${incident.incidentId}.`,
                        type: 'incident_response',
                        refId: incident.id,
                        refModel: 'Incident'
                    });
                }
            }
        }
 
        return this.getIncidentById(incidentId, context);
    }
 
    /**
     * Updates status, priority, or assignee.
     */
    async updateIncident(incidentId, context, updates) {
        const { organizationId, userId, role: userRole } = context;
        
        const incident = await prisma.incident.findUnique({ 
            where: { id_organizationId: { id: incidentId, organizationId } },
            include: { employee: true }
        });
 
        if (!incident || incident.isDeleted) throw new AppError('Incident not found', 404);
 
        const canEditAll = hasPermission(context.permissions, 'Support', 'Help & Support', 'edit');

        // RBAC: If not authorized agent, they must own the ticket
        if (!canEditAll && !context.isSuperAdmin && !context.isOwner) {
            const emp = await prisma.employee.findUnique({ 
                where: { userId_organizationId: { userId, organizationId } } 
            });
            if (!emp || incident.employeeId !== emp.id) {
                throw new AppError('You do not have permission to update this incident', 403);
            }
 
            const allowedForEmployee = ['Withdrawn', 'Open'];
            if (updates.status && !allowedForEmployee.includes(updates.status)) {
                throw new AppError(`Employees cannot set status to ${updates.status}`, 403);
            }
 
            delete updates.priority;
            delete updates.assignedToId;
        }
 
        const updated = await prisma.incident.update({
            where: { id_organizationId: { id: incident.id, organizationId } },
            data: {
                status: updates.status || undefined,
                priority: updates.priority || undefined,
                assignedToId: updates.assignedToId || undefined
            }
        });
 
        // Notifications
        if (updated.status === 'Resolved' && incident.status !== 'Resolved') {
            const reporterEmployee = await prisma.employee.findUnique({
                where: { id: incident.employeeId },
                include: { user: true }
            });
            if (reporterEmployee?.userId) {
                await notificationService.create({
                    userId: reporterEmployee.userId,
                    organizationId,
                    title: 'Incident Resolved',
                    message: `Your ticket ${incident.incidentId} has been marked as Resolved.`,
                    type: 'incident_resolved',
                    refId: incident.id,
                    refModel: 'Incident'
                });
            }
        }
 
        return updated;
    }
}
 
module.exports = new IncidentService();
