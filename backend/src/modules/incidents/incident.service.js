'use strict';

const Incident = require('./incident.model');
const AppError = require('../../shared/utils/AppError');
const notificationService = require('../notifications/notification.service');
const User = require('../users/user.model');

/**
 * Service to handle Incident operations
 */
class IncidentService {
    /**
     * Creates a new incident ticket and notifies admins.
     */
    async createIncident(employeeId, data, organizationId) {
        const incidentData = {
            ...data,
            employee: employeeId,
            organizationId,
            status: 'Open',
        };

        const incident = new Incident(incidentData);
        await incident.save();

        // Notify admins about the new incident
        await this._notifyAdminsAboutNewIncident(incident, employeeId, organizationId);

        return incident;
    }

    /**
     * Helper function to notify all active admins/managers about a new INC.
     */
    async _notifyAdminsAboutNewIncident(incident, reporterId, organizationId) {
        const reporter = await User.findOne({ _id: reporterId, organizationId }).select('name');
        const reporterName = reporter ? reporter.name : 'An employee';

        const message = `${reporterName} has raised a new ${incident.priority} priority incident (${incident.incidentId}) regarding '${incident.category}'.`;

        const admins = await User.find({ role: { $in: ['admin'] }, isActive: true, organizationId }).select('_id');
        const adminIds = admins.map((a) => a._id);

        if (adminIds.length > 0) {
            const notifications = adminIds.map((adminId) => ({
                userId: adminId,
                title: 'New Incident Ticket Raised',
                message: message,
                type: 'incident_created',
                refId: incident._id,
                refModel: 'Incident',
            }));
            await Promise.all(notifications.map(n => notificationService.create(n)));
        }
    }

    /**
     * Returns a paginated/filtered list of incidents.
     * If `userRole` is employee, forces the query to only match their `employeeId`.
     */
    async getIncidents(userId, userRole, queryParams = {}, organizationId) {
        const { status, priority, category, search, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = queryParams;

        const filter = { organizationId };

        // RBAC: Employees can only see their own
        if (userRole === 'employee') {
            filter.employee = userId;
        }

        // Apply optional filters
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (category) filter.category = category;

        // Apply search (case-insensitive on incidentId or title)
        if (search) {
            filter.$or = [
                { incidentId: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const total = await Incident.countDocuments(filter);
        const incidents = await Incident.find(filter)
            .populate('employee', 'name email employeeId')
            .populate('assignedTo', 'name')
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));

        return {
            incidents,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Retrieves a single incident by ID. Checks RBAC.
     */
    async getIncidentById(incidentId, userId, userRole, organizationId) {
        const incident = await Incident.findOne({ _id: incidentId, organizationId })
            .populate('employee', 'name email employeeId department')
            .populate('assignedTo', 'name email')
            .populate('relatedTimesheet', 'weekStartDate status')
            .populate('responses.user', 'name role');

        if (!incident) {
            throw new AppError('Incident not found', 404);
        }

        // RBAC check
        if (userRole === 'employee' && incident.employee._id.toString() !== userId.toString()) {
            throw new AppError('Incident not found', 404); // Hide unauthorized access
        }

        return incident;
    }

    /**
     * Add a response to an existing incident ticket.
     */
    async addResponse(incidentId, userId, userRole, message, organizationId) {
        const incident = await Incident.findOne({ _id: incidentId, organizationId });

        if (!incident) throw new AppError('Incident not found', 404);

        if (userRole === 'employee' && incident.employee.toString() !== userId.toString()) {
            throw new AppError('Incident not found', 404);
        }

        if (incident.status === 'Closed') {
            throw new AppError('Cannot reply to a closed incident.', 400);
        }

        const response = {
            message,
            user: userId,
            createdAt: new Date(),
        };

        incident.responses.push(response);

        // Auto status update:
        // If Admin replies to Open ticket -> In Progress
        if (userRole === 'admin' && incident.status === 'Open') {
            incident.status = 'In Progress';
        }

        await incident.save();

        // Notify the other party
        if (userRole === 'admin') {
            await notificationService.create({
                userId: incident.employee,
                title: 'Update on your Incident',
                message: `An admin replied to your ticket ${incident.incidentId}.`,
                type: 'incident_response',
                refId: incident._id,
                refModel: 'Incident'
            });
        } else {
            if (incident.assignedTo) {
                await notificationService.create({
                    userId: incident.assignedTo,
                    title: 'New Reply on Assigned Incident',
                    message: `An employee replied to ticket ${incident.incidentId}.`,
                    type: 'incident_response',
                    refId: incident._id,
                    refModel: 'Incident'
                });
            }
        }

        // Return the updated populated version to easily send back the new reply with user names
        return this.getIncidentById(incidentId, userId, userRole, organizationId);
    }

    /**
     * Updates status, priority, or assignee.
     * Employees can only update status to 'Withdrawn' (if Open/In Progress) or 'Open' (if Resolved/Closed - Reopening).
     */
    async updateIncident(incidentId, userId, userRole, updates, organizationId) {
        const incident = await Incident.findOne({ _id: incidentId, organizationId });

        if (!incident) throw new AppError('Incident not found', 404);

        // RBAC: If employee, they must own the ticket
        if (userRole === 'employee') {
            if (incident.employee.toString() !== userId.toString()) {
                throw new AppError('You do not have permission to update this incident', 403);
            }

            // Employee allowed status changes:
            // 1. Withdraw (any status except Withdrawn/Closed)
            // 2. Reopen (if Resolved/Closed/Withdrawn)
            const allowedForEmployee = ['Withdrawn', 'Open'];
            if (updates.status && !allowedForEmployee.includes(updates.status)) {
                throw new AppError(`Employees cannot set status to ${updates.status}`, 403);
            }

            // Reopening logic: if status is changed to Open from Resolved/Closed/Withdrawn
            if (updates.status === 'Open' && ['Resolved', 'Closed', 'Withdrawn'].includes(incident.status)) {
                // Keep it Open
            } else if (updates.status === 'Withdrawn') {
                // Withdraw it
            } else if (updates.status && updates.status !== incident.status) {
                throw new AppError('Invalid status transition for employee', 400);
            }

            // Employees cannot change priority or assignee
            delete updates.priority;
            delete updates.assignedTo;
        }

        // Apply allowed updates
        if (updates.status !== undefined) {
            const oldStatus = incident.status;
            incident.status = updates.status;

            // Notify if status changed to Resolved
            if (updates.status === 'Resolved' && oldStatus !== 'Resolved') {
                await notificationService.create({
                    userId: incident.employee,
                    title: 'Incident Resolved',
                    message: `Your ticket ${incident.incidentId} has been marked as Resolved.`,
                    type: 'incident_resolved',
                    refId: incident._id,
                    refModel: 'Incident'
                });
            }

            // Notify if employee reopens
            if (userRole === 'employee' && updates.status === 'Open' && oldStatus !== 'Open') {
                // Notify admin if assigned or all admins if not
                await this._notifyAdminsAboutUpdate(incident, `Ticket ${incident.incidentId} has been REOPENED by the employee.`);
            }

            // Notify if employee withdraws
            if (userRole === 'employee' && updates.status === 'Withdrawn' && oldStatus !== 'Withdrawn') {
                await this._notifyAdminsAboutUpdate(incident, `Ticket ${incident.incidentId} has been WITHDRAWN by the employee.`);
            }
        }

        if (updates.priority !== undefined && userRole === 'admin') {
            incident.priority = updates.priority;
        }

        if (updates.assignedTo !== undefined && userRole === 'admin') {
            incident.assignedTo = updates.assignedTo;
        }

        await incident.save();

        return incident;
    }

    /**
     * Notify assigned admin or all admins about an update.
     */
    async _notifyAdminsAboutUpdate(incident, message, organizationId) {
        if (incident.assignedTo) {
            await notificationService.create({
                userId: incident.assignedTo,
                title: 'Incident Updated',
                message: message,
                type: 'incident_updated',
                refId: incident._id,
                refModel: 'Incident',
            });
        } else {
            const admins = await User.find({ role: 'admin', isActive: true, organizationId }).select('_id');
            const adminIds = admins.map(a => a._id);
            if (adminIds.length > 0) {
                const notifications = adminIds.map(adminId => ({
                    userId: adminId,
                    title: 'Incident Updated',
                    message: message,
                    type: 'incident_updated',
                    refId: incident._id,
                    refModel: 'Incident',
                }));
                await Promise.all(notifications.map(n => notificationService.create(n)));
            }
        }
    }
}

module.exports = new IncidentService();
