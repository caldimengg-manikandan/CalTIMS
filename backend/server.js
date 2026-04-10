'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB, prisma } = require('./src/config/database');
const logger = require('./src/shared/utils/logger');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;

/**
 * Seed Super Admin on first boot (Prisma version)
 */
async function ensureSuperAdmin() {
  try {
    const adminEmail = 'superadmin@timesheetpro.com';
    const adminPassword = 'SuperAdmin@1234';

    // Upsert system organization
    let org = await prisma.organization.findFirst({
      where: { name: 'CALTIMS System' },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'CALTIMS System',
          slug: 'caltims-system',
          taxId: 'SYSTEM',
          address: 'System Cloud',
        },
      });
      logger.info('[Seed] System Organization created');
    }

    // Upsert subscription for system org
    const existingSub = await prisma.subscription.findFirst({
      where: { organizationId: org.id },
    });

    if (!existingSub) {
      const trialEnd = new Date();
      trialEnd.setFullYear(trialEnd.getFullYear() + 5);
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planType: 'PRO',
          status: 'ACTIVE',
          trialStartDate: new Date(),
          trialEndDate: trialEnd,
        },
      });
      logger.info('[Seed] System Subscription created');
    }

    // Upsert admin role
    let adminRole = await prisma.role.findFirst({
      where: { name: 'Admin', organizationId: org.id },
    });

    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          name: 'Admin',
          organizationId: org.id,
          permissions: { all: { all: ['all'] } },
        },
      });
    }

    // Upsert super admin user
    let superAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!superAdmin) {
      const hashed = await bcrypt.hash(adminPassword, 12);
      superAdmin = await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: adminEmail,
          password: hashed,
          role: 'super_admin',
          roleId: adminRole.id,
          organizationId: org.id,
          isActive: true,
          isOwner: true,
          isOnboardingComplete: true,
          provider: 'local',
          providers: ['local'],
        },
      });
      logger.info(`[Seed] Super Admin created: ${adminEmail}`);
    } else {
      if (superAdmin.role !== 'super_admin') {
        await prisma.user.update({
          where: { id: superAdmin.id },
          data: { role: 'super_admin' },
        });
        logger.info('[Seed] Super Admin role updated');
      }
    }

    // Seed org settings if missing
    const existingSettings = await prisma.orgSettings.findUnique({
      where: { organizationId: org.id },
    });
    if (!existingSettings) {
      await prisma.orgSettings.create({
        data: {
          organizationId: org.id,
          data: {
            organization: { companyName: 'CALTIMS System' },
            branding: { organizationName: 'CALTIMS System' },
          },
        },
      });
    }
  } catch (err) {
    logger.error(`[Seed] Error ensuring Super Admin: ${err.message}`);
  }
}

const startServer = async () => {
  try {
    // Connect to PostgreSQL via Prisma
    await connectDB();

    // Bootstrap super admin
    await ensureSuperAdmin();

    // Seed Payslip Templates (if service exists)
    try {
      const templateService = require('./src/modules/payroll/payslipTemplate.service');
      if (typeof templateService.seedTemplates === 'function') {
        await templateService.seedTemplates();
      }
    } catch (e) {
      logger.warn(`[Boot] payslipTemplate.service skipped: ${e.message}`);
    }

    // Start Background Payroll Worker (if exists)
    try {
      const payrollWorker = require('./src/modules/payroll/payroll.worker');
      if (typeof payrollWorker.startWorker === 'function') {
        payrollWorker.startWorker();
      }
    } catch (e) {
      logger.warn(`[Boot] payroll.worker skipped: ${e.message}`);
    }

    // Start Background Calendar Sync
    try {
      const calendarCron = require('./src/modules/calendar/calendar.cron');
      if (typeof calendarCron.initCalendarCron === 'function') {
        calendarCron.initCalendarCron();
        logger.info('[Boot] Calendar Sync Cron initialized');
      }
    } catch (e) {
      logger.warn(`[Boot] calendar.cron skipped: ${e.message}`);
    }

    const server = http.createServer(app);

    // Socket.io
    try {
      const socketService = require('./src/shared/services/socket.service');
      socketService.init(server);
    } catch (e) {
      logger.warn(`[Boot] socket.service skipped: ${e.message}`);
    }

    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('HTTP server closed. Prisma disconnected.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

startServer();
