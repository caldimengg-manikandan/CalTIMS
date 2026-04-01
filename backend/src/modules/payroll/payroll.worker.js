'use strict';

const PayrollJob = require('./payrollJob.model');
const ProcessedPayroll = require('./processedPayroll.model');
const emailService = require('../../shared/services/email.service');
const pdfGeneratorService = require('../reports/pdfGenerator.service');
const Settings = require('../settings/settings.model');
const logger = require('../../shared/utils/logger');

/**
 * PayrollWorker - Simplified Internal Background Processor
 * In a real Bank-Grade system, this would be BullMQ / SQS
 */
const processJobs = async () => {
    const jobs = await PayrollJob.find({ 
        status: { $in: ['Pending', 'Failed'] },
        attempts: { $lt: 3 }
    }).limit(10).sort({ priority: -1, createdAt: 1 });

    for (const job of jobs) {
        job.status = 'Processing';
        job.attempts += 1;
        await job.save();

        try {
            if (job.type === 'SEND_PAYSLIP_EMAILS') {
                const { ids, organizationId } = job.payload;
                const payrolls = await ProcessedPayroll.find({ _id: { $in: ids }, organizationId }).populate('user');
                const settings = await Settings.findOne({ organizationId });
                
                // Reuse existing bulk email logic but in background
                const bulkData = payrolls.map(p => ({
                    email: p.user?.email || p.employeeInfo?.email,
                    data: {
                        user: p.user,
                        month: p.month,
                        year: p.year,
                        breakdown: p.breakdown,
                        attendance: p.attendance,
                        currencySymbol: settings?.payroll?.currencySymbol || '₹',
                        employeeInfo: p.employeeInfo,
                        bankDetails: p.bankDetails
                    }
                })).filter(x => x.email);

                const results = await emailService.sendPayslipsBulk(bulkData);
                
                // Update records
                if (results.sent > 0) {
                   const failedEmails = new Set(results.errors.map(e => e.email));
                   const successfulIds = payrolls
                       .filter(p => !failedEmails.has(p.user?.email || p.employeeInfo?.email))
                       .map(p => p._id);
                   
                   await ProcessedPayroll.updateMany(
                       { _id: { $in: successfulIds } },
                       { $set: { isEmailSent: true, lastEmailSentAt: new Date() } }
                   );
                }
            }

            job.status = 'Completed';
            job.processedAt = new Date();
            await job.save();

        } catch (err) {
            logger.error(`[PayrollWorker] Job ${job._id} failed: ${err.message}`);
            job.status = 'Failed';
            job.lastError = err.message;
            await job.save();
        }
    }
};

// Start simple polling interval
const startWorker = () => {
    logger.info('🏦 Bank-Grade Payroll Worker Started');
    setInterval(processJobs, 30000); // Check every 30 seconds
};

module.exports = { startWorker, processJobs };
