'use strict';

const cron = require('node-cron');
const hikvisionService = require('./hikvision.service');
const logger = require('../../shared/utils/logger');

let _job = null;

const hikvisionCron = {
  /**
   * Start the Hikvision sync cron job.
   * Runs every 5 minutes.
   */
  start() {
    if (_job) return;

    // Run every 5 minutes
    _job = cron.schedule('*/5 * * * *', async () => {
      logger.info('[HikvisionCron] Running scheduled synchronization...');
      try {
        const results = await hikvisionService.syncAllDevices();
        const successCount = results.filter(r => r.success).length;
        logger.info(`[HikvisionCron] Sync completed. Successful: ${successCount}/${results.length}`);
      } catch (err) {
        logger.error('[HikvisionCron] Critical error during scheduled sync:', err.message);
      }
    });

    logger.info('[HikvisionCron] ✅ Hikvision synchronization service started (every 5 minutes).');
  },

  /**
   * Stop the cron job.
   */
  stop() {
    if (_job) {
      _job.stop();
      _job = null;
      logger.info('[HikvisionCron] Hikvision synchronization service stopped.');
    }
  }
};

module.exports = hikvisionCron;
