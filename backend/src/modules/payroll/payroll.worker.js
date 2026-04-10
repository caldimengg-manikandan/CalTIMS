'use strict';

const { prisma } = require('../../config/database');
const emailService = require('../../shared/services/email.service');
const logger = require('../../shared/utils/logger');

/**
 * PayrollWorker - Simplified Internal Background Processor
 * Refactored to Prisma Client
 */
const processJobs = async () => {
    try {
        const jobs = await prisma.payrollJob.findMany({ 
            where: {
                status: { in: ['Pending', 'Failed'] },
                attempts: { lt: 3 },
                isDeleted: false
            },
            take: 10,
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' }
            ]
        });

        for (const job of jobs) {
            // Mark as processing
            await prisma.payrollJob.update({
                where: { id: job.id },
                data: { status: 'Processing', attempts: job.attempts + 1 }
            });

            try {
                if (job.type === 'SEND_PAYSLIP_EMAILS') {
                    const { ids, organizationId } = job.payload;
                    
                    const payslips = await prisma.payslip.findMany({
                        where: { id: { in: ids }, organizationId },
                        include: { 
                            employee: { include: { user: true } },
                            processedPayroll: true 
                        }
                    });

                    const orgSettings = await prisma.orgSettings.findUnique({ where: { organizationId } });
                    const settings = orgSettings?.data || {};
                    
                    const bulkData = payslips.map(p => {
                        const user = p.employee?.user;
                        return {
                            email: user?.email || p.employeeInfo?.email,
                            data: {
                                ...p.processedPayroll, // Use the actual payroll data snapshot
                                companyId: organizationId,
                                user: user,
                                currencySymbol: settings?.payroll?.currencySymbol || '₹',
                                // Ensure standard fields are exposed if template expects them
                                employeeInfo: p.employeeInfo,
                                bankDetails: p.bankDetails,
                                breakdown: p.breakdown,
                                attendance: p.attendance,
                                month: p.month,
                                year: p.year
                            }
                        };
                    }).filter(x => x.email);

                    if (bulkData.length > 0) {
                        const results = await emailService.sendPayslipsBulk(bulkData);
                        
                        // Update records
                        if (results.sent > 0) {
                           const failedEmails = new Set(results.errors.map(e => e.email));
                           const successfulPayslipIds = payslips
                               .filter(p => !failedEmails.has(p.employee?.user?.email || p.employeeInfo?.email))
                               .map(p => p.id);
                           
                           if (successfulPayslipIds.length > 0) {
                               await prisma.payslip.updateMany({
                                   where: { id: { in: successfulPayslipIds } },
                                   data: { isEmailSent: true, status: 'SENT', lastEmailSentAt: new Date() }
                               });
                           }
                        }
                    }
                }

                // Mark as completed
                await prisma.payrollJob.update({
                    where: { id: job.id },
                    data: { status: 'Completed', processedAt: new Date() }
                });

            } catch (err) {
                logger.error(`[PayrollWorker] Job ${job.id} failed: ${err.message}`);
                await prisma.payrollJob.update({
                    where: { id: job.id },
                    data: { status: 'Failed', lastError: err.message }
                });
            }
        }
    } catch (err) {
        logger.error(`[PayrollWorker] Global Error: ${err.message}`);
    }
};

const startWorker = () => {
    logger.info('🏦 Bank-Grade Payroll Worker Started (Prisma Mode)');
    setInterval(processJobs, 30000); // Check every 30 seconds
};

module.exports = { startWorker, processJobs };
