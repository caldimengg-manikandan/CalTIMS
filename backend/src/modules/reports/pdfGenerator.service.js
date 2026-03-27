'use strict';

const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const puppeteer = require('puppeteer');
const payslipTemplateService = require('../payroll/payslipTemplate.service');

/**
 * Service to generate PDF payslips matching the Statement Preview design
 * Premium enterprise payslip with modern styling rendered via Puppeteer
 */
class PDFGeneratorService {
    constructor() {
        this.browser = null;
    }

    /**
     * Launch or reuse a puppeteer browser instance
     */
    async _getBrowser() {
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
            });
        }
        return this.browser;
    }

    /**
     * Renders payroll data to a PDF buffer using Puppeteer
     */
    async _renderHtmlToPdf(payroll, settings = {}, customHtml = null) {
        const browser = await this._getBrowser();
        const page = await browser.newPage();
        
        try {
            let html = '';
            if (customHtml) {
                html = customHtml;
            } else {
                // Determine which template to use
                const template = await payslipTemplateService.getDefaultTemplate(payroll.companyId);
                const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
                html = payslipTemplateService.renderTemplate(template.htmlContent, templateData, template.backgroundImageUrl);
            }
            
            // Set content and wait for network idle to ensure fonts/styles are loaded
            await page.setContent(html, { 
                waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
                timeout: 30000 
            });

            // Add global print-specific tweaks if needed
            await page.addStyleTag({
                content: `
                    @page { size: A4; margin: 0; }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .payslip-container {
                        margin: 0 !important;
                        border: none !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        max-width: none !important;
                        width: 100% !important;
                        min-height: 297mm; /* Full A4 height */
                    }
                    .no-print { display: none !important; }
                `
            });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                preferCSSPageSize: true
            });

            return pdfBuffer;
        } finally {
            await page.close();
        }
    }
    /**
     * Generates a premium payslip PDF matching the Statement Preview component
     * @param {Object} res - Express response object
     * @param {Object} payroll - Processed payroll data
     */
    async generatePayslip(res, payroll, settings = {}) {
        try {
            const pdfBuffer = await this._renderHtmlToPdf(payroll, settings);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="Payslip-${payroll.employeeInfo.employeeId}-${payroll.month}-${payroll.year}.pdf"`);
            
            return res.send(pdfBuffer);
        } catch (error) {
            console.error('PDF Generation Error:', error);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
            }
        }
    }

    /**
     * Generates payslip as buffer for email attachments
     * @param {Object} payroll - Processed payroll data
     * @returns {Promise<Buffer>}
     */
    async generatePayslipBuffer(payroll, settings = {}) {
        return this._renderHtmlToPdf(payroll, settings);
    }

    /**
     * Cleanup browser on process exit
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Additional enterprise report generator (kept for compatibility)
     */
    async generateEnterpriseWorkforceReport(res, data, options) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Enterprise-Report-${format(options.now, 'yyyyMMdd')}.pdf"`);
            
            doc.pipe(res);
            res.on('error', reject);
            doc.on('end', resolve);

            // Quick implementation for enterprise report
            const colors = {
                primary: '#4f46e5', bg: '#f8fafc', surface: '#ffffff',
                textMain: '#0f172a', textMuted: '#64748b', border: '#e2e8f0'
            };
            
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
            doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(14).text('ENTERPRISE INTELLIGENCE', 60, 100);
            doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(48).text('Workforce', 60, 130).text('Productivity', 60, 185);
            doc.fillColor(colors.primary).text('Report.', 60, 240);
            
            this._addPageFooter(doc, 1, 3, colors, 'System Generated Confidential Report');
            doc.end();
        });
    }

    /**
     * Page footer helper
     */
    _addPageFooter(doc, current, total, colors, extra = 'CALTIMS Enterprise Intelligence') {
        const pageHeight = doc.page.height;
        doc.moveTo(50, pageHeight - 60).lineTo(550, pageHeight - 60).strokeColor(colors.border).lineWidth(1).stroke();
        doc.fillColor(colors.textMuted).font('Helvetica').fontSize(8);
        doc.text(extra, 50, pageHeight - 45);
        doc.text(`Page ${current} of ${total}`, 50, pageHeight - 45, { align: 'right', width: 500 });
    }
}

module.exports = new PDFGeneratorService();