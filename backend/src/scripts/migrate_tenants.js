'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../modules/organizations/organization.model');
const User = require('../modules/users/user.model');
const Project = require('../modules/projects/project.model');
const Timesheet = require('../modules/timesheets/timesheet.model');
const Role = require('../modules/users/role.model');
const Leave = require('../modules/leaves/leave.model');
const Settings = require('../modules/settings/settings.model');
const Announcement = require('../modules/announcements/announcement.model');
const Incident = require('../modules/incidents/incident.model');
const Notification = require('../modules/notifications/notification.model');
const { SupportTicket } = require('../modules/support/support.model');
const Task = require('../modules/tasks/task.model');
const ReportSchedule = require('../modules/reportSchedules/reportSchedule.model');
const CalendarEvent = require('../modules/calendar/calendar.model');
const AttendanceLog = require('../modules/attendance/attendance.model');
const Device = require('../modules/attendance/device.model');
const PayrollPolicy = require('../modules/policyEngine/payrollPolicy.model');
const OrganizationPolicy = require('../modules/policyEngine/organizationPolicy.model');
const PayrollBatch = require('../modules/payroll/payrollBatch.model');
const PayrollProfile = require('../modules/payroll/payrollProfile.model');
const ProcessedPayroll = require('../modules/payroll/processedPayroll.model');
const SalaryStructure = require('../modules/payroll/roleSalaryStructure.model');
const PayslipDesign = require('../modules/payroll/payslipDesign.model');
const PayslipTemplate = require('../modules/payroll/payslipTemplate.model');
const AuditLog = require('../modules/audit/audit.model');
const ActivityLog = require('../modules/audit/userActivityLog.model');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caltims';

async function migrate() {
    console.log('--- Starting Multi-Tenant Data Migration ---');
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // 1. Ensure Default Organization
        let defaultOrg = await Organization.findOne({ name: 'Caldim Engineering' });
        if (!defaultOrg) {
            console.log('Creating default organization...');
            defaultOrg = await Organization.create({
                name: 'Caldim Engineering',
                address: 'Headquarters',
                taxId: 'GENERIC-TAX-ID'
            });
        }
        console.log(`Using organization: ${defaultOrg.name} (${defaultOrg._id})`);

        const organizationId = defaultOrg._id;

        // 2. Collections to migrate
        const collections = [
            { name: 'User', model: User },
            { name: 'Project', model: Project },
            { name: 'Timesheet', model: Timesheet },
            { name: 'Role', model: Role },
            { name: 'Leave', model: Leave },
            { name: 'Settings', model: Settings },
            { name: 'Announcement', model: Announcement },
            { name: 'Incident', model: Incident },
            { name: 'Notification', model: Notification },
            { name: 'SupportTicket', model: SupportTicket },
            { name: 'Task', model: Task },
            { name: 'ReportSchedule', model: ReportSchedule },
            { name: 'CalendarEvent', model: CalendarEvent },
            { name: 'AttendanceLog', model: AttendanceLog },
            { name: 'Device', model: Device },
            { name: 'PayrollPolicy', model: PayrollPolicy },
            { name: 'OrganizationPolicy', model: OrganizationPolicy },
            { name: 'PayrollBatch', model: PayrollBatch },
            { name: 'PayrollProfile', model: PayrollProfile },
            { name: 'ProcessedPayroll', model: ProcessedPayroll },
            { name: 'SalaryStructure', model: SalaryStructure },
            { name: 'PayslipDesign', model: PayslipDesign },
            { name: 'PayslipTemplate', model: PayslipTemplate },
            { name: 'AuditLog', model: AuditLog },
            { name: 'ActivityLog', model: ActivityLog }
        ];

        for (const col of collections) {
            if (!col.model) {
                console.error(`Skipping ${col.name} because model is missing!`);
                continue;
            }
            console.log(`Processing ${col.name}...`);
            const updateResult = await col.model.updateMany(
                { organizationId: { $in: [null, undefined] } },
                { $set: { organizationId } }
            );
            console.log(`Updated ${updateResult.modifiedCount} records in ${col.name}.`);
        }

        console.log('--- Migration Completed Successfully ---');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
}

migrate();
