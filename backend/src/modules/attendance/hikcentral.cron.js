'use strict';

const cron = require('node-cron');
const hikcentralService = require('./hikcentral.service');
const logger = require('../../shared/utils/logger');

let _job = null;

const hikcentralCron = {
  /**
   * Start the HikCentral sync cron job.
   * Runs every 5 minutes.
   */
  start() {
    if (_job) return;
 
    _job = cron.schedule('*/5 * * * *', async () => {
      logger.info('[HikCentralCron] Running scheduled synchronization...');
      try {
        const results = await hikcentralService.syncAll();
        const successCount = results.filter(r => r.success).length;
        logger.info(`[HikCentralCron] Sync completed. Successful: ${successCount}/${results.length}`);
      } catch (err) {
        logger.error('[HikCentralCron] Critical error during scheduled sync:', err.message);
      }
    });

    logger.info('[HikCentralCron] ✅ HikCentral synchronization service started (every 5 minutes).');
  },

  /**
   * Stop the cron job.
   */
  stop() {
    if (_job) {
      _job.stop();
      _job = null;
      logger.info('[HikCentralCron] HikCentral synchronization service stopped.');
    }
  }
};

module.exports = hikcentralCron;
