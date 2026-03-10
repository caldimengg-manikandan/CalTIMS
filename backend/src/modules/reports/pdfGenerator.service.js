'use strict';

const PDFDocument = require('pdfkit');
const { format } = require('date-fns');

/**
 * Service to generate PDF reports using PDFKit
 */
class PDFGeneratorService {
    /**
     * Generates a corporate-style Workforce Productivity Report
     * @param {Object} res - Express response object
     * @param {Object} data - Processed data for the report
     * @param {Object} options - Additional options (dates, title, etc.)
     */
    async generateEnterpriseWorkforceReport(res, data, options) {
        const { from, to, now } = options;
        const { stats, projectData, leaveData, weeklyTrend, employeeData, deptStats, complianceStats } = data;

        // Create a new PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            bufferPages: true // Enable buffering to handle total page count
        });

        // Pipe the PDF to the response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Workforce-Productivity-Report-${format(now, 'yyyyMMdd')}.pdf"`);
        doc.pipe(res);

        // ════════════════════════════════════════════════════════════════════════════
        // PAGE 1 — COVER PAGE
        // ════════════════════════════════════════════════════════════════════════════

        // Background Graphic / Gradient
        doc.rect(0, 0, doc.page.width, doc.page.height * 0.4)
            .fill('#f8f9fa');

        doc.moveTo(0, doc.page.height * 0.4)
            .lineTo(doc.page.width, doc.page.height * 0.35)
            .lineTo(doc.page.width, doc.page.height * 0.4)
            .closePath()
            .fill('#f8f9fa');

        // Title Section
        doc.fillColor('#1e293b')
            .font('Helvetica-Bold')
            .fontSize(36)
            .text('CALTIMS', 50, doc.page.height * 0.25);

        doc.fillColor('#475569')
            .fontSize(24)
            .text('Workforce Productivity Report', 50, doc.page.height * 0.32);

        // Metadata
        doc.fontSize(12)
            .fillColor('#64748b')
            .text('Organization:', 50, doc.page.height * 0.5)
            .fontSize(14)
            .fillColor('#334155')
            .text('Caldim Engineering', 150, doc.page.height * 0.5);

        doc.fontSize(12)
            .fillColor('#64748b')
            .text('Report Period:', 50, doc.page.height * 0.55)
            .fontSize(14)
            .fillColor('#334155')
            .text(`${from ? format(from, 'MMM yyyy') : 'All Time'} – ${to ? format(to, 'MMM yyyy') : format(now, 'MMM yyyy')}`, 150, doc.page.height * 0.55);

        doc.fontSize(12)
            .fillColor('#64748b')
            .text('Generated On:', 50, doc.page.height * 0.6)
            .fontSize(14)
            .fillColor('#334155')
            .text(format(now, 'MMMM d, yyyy'), 150, doc.page.height * 0.6);

        // Prepared by
        doc.moveDown(10)
            .fontSize(10)
            .fillColor('#94a3b8')
            .text('Prepared by:', 50, doc.page.height * 0.8)
            .fontSize(12)
            .fillColor('#475569')
            .text('CALTIMS Workforce Intelligence');

        // Footer for Page 1
        this._addFooter(doc, 'Confidential – Internal Use Only');

        // ════════════════════════════════════════════════════════════════════════════
        // PAGE 2 — EXECUTIVE DASHBOARD
        // ════════════════════════════════════════════════════════════════════════════
        doc.addPage();
        this._addHeader(doc, 'Executive Summary');

        // KPI Cards
        const cardWidth = 160;
        const cardHeight = 80;
        const startX = 50;
        const startY = 120;

        // Row 1
        this._drawKPICard(doc, startX, startY, cardWidth, cardHeight, 'Total Hours Logged', `${stats.totalHours.toLocaleString()}h`);
        this._drawKPICard(doc, startX + cardWidth + 15, startY, cardWidth, cardHeight, 'Active Employees', stats.uniqueEmployees.length.toString());
        this._drawKPICard(doc, startX + (cardWidth + 15) * 2, startY, cardWidth, cardHeight, 'Projects Active', projectData.length.toString());

        // Row 2
        const complianceRate = complianceStats.total > 0 ? ((complianceStats.approved / complianceStats.total) * 100).toFixed(0) : '0';
        const avgHours = stats.uniqueEmployees.length > 0 ? (stats.totalHours / stats.uniqueEmployees.length).toFixed(1) : '0';

        this._drawKPICard(doc, startX, startY + cardHeight + 15, cardWidth, cardHeight, 'Weekly Submissions', stats.totalTimesheets.toString());
        this._drawKPICard(doc, startX + cardWidth + 15, startY + cardHeight + 15, cardWidth, cardHeight, 'Avg Hours / Employee', `${avgHours}h`);
        this._drawKPICard(doc, startX + (cardWidth + 15) * 2, startY + cardHeight + 15, cardWidth, cardHeight, 'Compliance Rate', `${complianceRate}%`);

        // Insights Section
        doc.moveDown(8);
        doc.fontSize(14).fillColor('#1e293b').font('Helvetica-Bold').text('Operational Insights');
        doc.rect(50, doc.y + 10, 500, 100).fill('#f1f5f9');
        doc.y += 25;
        doc.fontSize(10).fillColor('#475569').font('Helvetica').text('• Overall productivity remains stable within the reporting period.', 70);
        doc.moveDown(0.5);
        if (deptStats.length > 0) {
            doc.text(`• ${deptStats[0]._id || 'General'} department accounts for the highest contribution (${((deptStats[0].totalHours / stats.totalHours) * 100).toFixed(0)}% of total hours).`, 70);
        }
        doc.moveDown(0.5);
        doc.text('• Timesheet compliance indicates a standard level of engagement across active project teams.', 70);
        doc.moveDown(0.5);
        doc.text('• Utilization across top projects suggests effective resource allocation.', 70);

        // Distribution Charts (Text representation for now)
        doc.moveDown(6);
        doc.fontSize(14).fillColor('#1e293b').font('Helvetica-Bold').text('Project Distribution');
        doc.moveDown(1);

        // Drawing a simple bar chart
        let yPos = doc.y;
        projectData.slice(0, 5).forEach((item, i) => {
            const barMax = 300;
            const barWidth = (item.totalHours / projectData[0].totalHours) * barMax;

            doc.fontSize(9).fillColor('#64748b').text(item.project?.name || 'Unknown', 50, yPos);
            doc.rect(150, yPos - 5, barWidth, 15).fill('#6366f1');
            doc.fillColor('#1e293b').text(`${item.totalHours}h`, 150 + barWidth + 10, yPos);
            yPos += 25;
        });

        this._addFooter(doc);

        // ════════════════════════════════════════════════════════════════════════════
        // PAGE 3 — DETAILED PERFORMANCE
        // ════════════════════════════════════════════════════════════════════════════
        doc.addPage();
        this._addHeader(doc, 'Resource Performance & Utilization');

        doc.moveDown(2);
        doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold').text('Employee Productivity (Top 15)');
        doc.moveDown(1);

        // Table Header
        const tableTop = doc.y;
        doc.rect(50, tableTop - 5, 500, 20).fill('#f8f9fa');
        doc.fontSize(9).fillColor('#475569').font('Helvetica-Bold');
        doc.text('Employee', 60, tableTop);
        doc.text('ID', 180, tableTop);
        doc.text('Department', 250, tableTop);
        doc.text('Hours', 380, tableTop);
        doc.text('Participation', 460, tableTop);

        // Table Rows
        let itemY = tableTop + 25;
        doc.font('Helvetica').fontSize(9).fillColor('#334155');

        employeeData.forEach((emp, i) => {
            if (itemY > 700) {
                this._addFooter(doc);
                doc.addPage();
                this._addHeader(doc, 'Resource Performance (continued)');
                itemY = 120;
            }

            doc.text(emp.user?.name || 'Unknown', 60, itemY);
            doc.text(emp.user?.employeeId || '-', 180, itemY);
            doc.text(emp.user?.department || '-', 250, itemY);
            doc.text(`${emp.totalHours}h`, 380, itemY);
            doc.text(`${emp.timesheetCount} wks`, 460, itemY);

            doc.moveTo(50, itemY + 15).lineTo(550, itemY + 15).strokeColor('#f1f5f9').stroke();
            itemY += 25;
        });

        this._addFooter(doc);

        // Finalize the PDF
        doc.end();
    }

    // Helper: Header
    _addHeader(doc, title) {
        doc.fillColor('#1e293b')
            .font('Helvetica-Bold')
            .fontSize(18)
            .text(title, 50, 50);

        doc.moveTo(50, 75)
            .lineTo(550, 75)
            .strokeColor('#e2e8f0')
            .stroke();
    }

    // Helper: Footer
    _addFooter(doc, extra = '') {
        const pageCount = doc.bufferedPageRange().count;
        const current = doc.bufferedPageRange().start + 1;

        doc.fontSize(8)
            .fillColor('#94a3b8')
            .font('Helvetica')
            .text(`© 2026 CALTIMS Enterprise Intelligence | ${extra}`, 50, doc.page.height - 50, { align: 'left' })
            .text(`Page ${doc.bufferedPageRange().start + 1}`, 50, doc.page.height - 50, { align: 'right' });
    }

    // Helper: KPI Card
    _drawKPICard(doc, x, y, w, h, title, value) {
        doc.roundedRect(x, y, w, h, 8)
            .fillColor('#ffffff')
            .strokeColor('#e2e8f0')
            .fillAndStroke();

        doc.fillColor('#64748b')
            .font('Helvetica')
            .fontSize(9)
            .text(title, x + 15, y + 20);

        doc.fillColor('#1e293b')
            .font('Helvetica-Bold')
            .fontSize(18)
            .text(value, x + 15, y + 38);
    }
}

module.exports = new PDFGeneratorService();
