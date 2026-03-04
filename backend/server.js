'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const logger = require('./src/shared/utils/logger');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

// Drop legacy overly-restrictive unique index on timesheets (one-time migration)
async function dropLegacyIndexes() {
  try {
    const col = mongoose.connection.collection('timesheets');
    await col.dropIndex('userId_1_weekStartDate_1');
    logger.info('Dropped legacy unique index: userId_1_weekStartDate_1');
  } catch (err) {
    // Error code 27 = IndexNotFound — that's fine, already dropped
    if (err.code !== 27 && !err.message?.includes('index not found')) {
      logger.warn(`Index drop skipped: ${err.message}`);
    }
  }
}

// Auto-backfill: create timesheet entries for any approved leave that doesn't have one yet
// Also repairs orphaned leave timesheets pointing to non-existent projects
async function autoBackfillLeaveTimesheets() {
  try {
    const leaveService = require('./src/modules/leaves/leave.service');
    const User = require('./src/modules/users/user.model');
    const Timesheet = require('./src/modules/timesheets/timesheet.model');
    const Project = require('./src/modules/projects/project.model');

    const admin = await User.findOne({ role: { $in: ['admin', 'manager'] }, isActive: true }).select('_id');
    if (!admin) return;

    // 1. Repair orphaned leave timesheets (fixes the "() Sick" issue)
    const leaveProject = await Project.findOne({ code: 'LEAVE-SYS' });
    if (leaveProject) {
      const orphans = await Timesheet.find({
        $or: [{ isLeave: true }, { category: { $in: ['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Paternity'] } }],
        projectId: { $ne: leaveProject._id }
      });
      if (orphans.length > 0) {
        await Timesheet.updateMany(
          { _id: { $in: orphans.map(o => o._id) } },
          { $set: { projectId: leaveProject._id } }
        );
        logger.info(`[AutoBackfill] Repaired ${orphans.length} orphaned leave timesheets`);
      }
    }

    // 2. Perform regular backfill
    const result = await leaveService.backfillTimesheets(admin._id);
    if (result.synced > 0) {
      logger.info(`[AutoBackfill] Created timesheets for ${result.synced} approved leave(s)`);
    }
  } catch (err) {
    logger.warn(`[AutoBackfill] Leave timesheet backfill failed: ${err.message}`);
  }
}

const startServer = async () => {
  try {
    await connectDB();
    await dropLegacyIndexes();

    // Auto-sync any approved leaves that are missing timesheet entries
    await autoBackfillLeaveTimesheets();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed.');
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
