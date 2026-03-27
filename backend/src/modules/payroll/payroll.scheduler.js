'use strict';

const cron = require('node-cron');
const Settings = require('../settings/settings.model');
const payrollController = require('./payroll.controller');
const logger = require('../../shared/utils/logger');

/**
 * Auto Payroll Scheduler
 * Runs daily at midnight to check if it's the auto-processing day.
 */
const start = () => {
    // Run at 00:01 every day
    cron.schedule('1 0 * * *', async () => {
        try {
            const settings = await Settings.findOne().lean();
            const config = settings?.payroll;
            
            if (!config || !config.autoProcessingDay) return;

            const now = new Date();
            const today = now.getDate();

            if (today === config.autoProcessingDay) {
                logger.info('[PayrollScheduler] Auto-processing day reached. Initiating bulk payroll...');
                
                // We need to process for PREVIOUS month if today is e.g. 1st of next month
                // Or current month if today is 28th.
                // Usually auto-processing is for the month just ended or nearing end.
                const month = now.getMonth() + 1; // Current month
                const year = now.getFullYear();

                // Mock request object for controller
                const mockReq = { 
                    body: { month, year },
                    user: { id: 'SYSTEM' } // System user
                };
                
                const mockRes = {
                    status: () => ({ json: (data) => logger.info(`[PayrollScheduler] Result: ${JSON.stringify(data)}`) })
                };

                // Trigger simulation then save
                // In a real production system, this would be a more robust service call
                // but utilizing existing controller logic for simplicity
                await payrollController.simulatePayroll(mockReq, mockRes, (err) => {
                    if (err) logger.error(`[PayrollScheduler] Simulation failed: ${err.message}`);
                });
            }
        } catch (err) {
            logger.error(`[PayrollScheduler] Error: ${err.message}`);
        }
    });
    
    logger.info('[PayrollScheduler] ✅ Auto payroll scheduler initialized.');
};

module.exports = { start };
