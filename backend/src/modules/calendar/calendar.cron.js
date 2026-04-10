const cron = require('node-cron');
const { prisma } = require('../../config/database');
const calendarService = require('./calendar.service');
const logger = require('../../shared/utils/logger');

// Run every 15 minutes
const initCalendarCron = () => {
    cron.schedule('*/15 * * * *', async () => {
        logger.info('Starting Background Calendar Sync...');
        
        try {
            // Fetch all active integrations
            const integrations = await prisma.calendarIntegration.findMany({
                where: { status: 'CONNECTED' }
            });

            logger.info(`Found ${integrations.length} integrations to sync.`);

            for (const integration of integrations) {
                try {
                    await calendarService.syncEvents(integration.id);
                    logger.info(`Successfully synced ${integration.provider} for user ${integration.userId}`);
                } catch (error) {
                    logger.error(`Failed to sync ${integration.provider} for user ${integration.userId}: ${error.message}`);
                }
            }

            logger.info('Background Calendar Sync Completed.');
        } catch (error) {
            logger.error(`Global Calendar Cron Error: ${error.message}`);
        }
    });
};

module.exports = { initCalendarCron };
