'use strict';

const cron = require('node-cron');
const { prisma } = require('../../config/database');
const payrollController = require('./payroll.controller');
const logger = require('../../shared/utils/logger');

/**
 * Auto Payroll Scheduler
 * Refactored to Prisma Client
 */
const start = () => {
    // Run at 00:01 every day
    cron.schedule('1 0 * * *', async () => {
        try {
            logger.info('[PayrollScheduler] Checking for auto-processing tasks...');
            const allSettings = await prisma.orgSettings.findMany();
            
            const now = new Date();
            const today = now.getDate();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            for (const setting of allSettings) {
                const config = setting.data?.payroll;
                if (!config || !config.autoProcessingDay) continue;

                if (today === config.autoProcessingDay) {
                    const organizationId = setting.organizationId;
                    logger.info(`[PayrollScheduler] Day reached for Org: ${organizationId}. Initiating...`);
                    
                    const mockReq = { 
                        body: { month, year },
                        organizationId: organizationId,
                        user: { id: 'SYSTEM', role: 'system' },
                        ip: '127.0.0.1'
                    };
                    
                    const mockRes = {
                        status: () => ({ json: (data) => logger.info(`[PayrollScheduler] Result: ${JSON.stringify(data)}`) })
                    };

                    await payrollController.runPayrollExecution(mockReq, mockRes, (err) => {
                        if (err) logger.error(`[PayrollScheduler] [${organizationId}] Engine failed: ${err.message}`);
                    });
                }
            }
        } catch (err) {
            logger.error(`[PayrollScheduler] Global Error: ${err.message}`);
        }
    });
    
    logger.info('[PayrollScheduler] ✅ Auto payroll scheduler initialized (Prisma Mode).');
};

module.exports = { start };
