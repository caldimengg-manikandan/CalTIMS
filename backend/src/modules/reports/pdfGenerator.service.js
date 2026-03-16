'use strict';

const PDFDocument = require('pdfkit');
const { format } = require('date-fns');

/**
 * Service to generate PDF reports using PDFKit
 * Optimized for a 3-page, premium light-themed enterprise report
 */
class PDFGeneratorService {
    /**
     * Generates a premium 3-page Workforce Productivity Report
     * @param {Object} res - Express response object
     * @param {Object} data - Processed data for the report
     * @param {Object} options - Additional options (dates, title, etc.)
     */
    async generateEnterpriseWorkforceReport(res, data, options) {
        const { from, to, now } = options;
        const { stats, projectData, weeklyTrend, employeeData, deptStats, complianceStats } = data;

        // Create a new PDF document with strict 3-page limit
        const doc = new PDFDocument({
            size: 'A4',
            margin: 0, // Manual margins for better control
            bufferPages: true
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Enterprise-Report-${format(now, 'yyyyMMdd')}.pdf"`);
        doc.pipe(res);

        // Define Color Palette (Premium Indigo Light Theme)
        const colors = {
            primary: '#4f46e5',    // Indigo 600
            secondary: '#818cf8',  // Indigo 400
            accent: '#c7d2fe',     // Indigo 200
            bg: '#f8fafc',         // Slate 50
            surface: '#ffffff',     // White
            textMain: '#0f172a',   // Slate 900
            textMuted: '#64748b',  // Slate 500
            border: '#e2e8f0',     // Slate 200
            success: '#10b981',    // Emerald 500
            warning: '#f59e0b'     // Amber 500
        };

        // ════════════════════════════════════════════════════════════════════════════
        // PAGE 1 — PREMIUM COVER PAGE
        // ════════════════════════════════════════════════════════════════════════════
        
        // Background Gradient-like shapes
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
        
        // Soft accent blob at top right
        doc.fillColor(colors.bg)
           .circle(doc.page.width, 0, 300)
           .fill();

        // Left accent bar
        doc.rect(0, 0, 10, doc.page.height).fill(colors.primary);

        // Title Section
        doc.fillColor(colors.primary)
            .font('Helvetica-Bold')
            .fontSize(14)
            .text('ENTERPRISE INTELLIGENCE', 60, 100);

        doc.fillColor(colors.textMain)
            .font('Helvetica-Bold')
            .fontSize(48)
            .text('Workforce', 60, 130)
            .text('Productivity', 60, 185)
            .fillColor(colors.primary)
            .text('Report.', 60, 240);

        // Subtitle / Description
        doc.fillColor(colors.textMuted)
            .font('Helvetica')
            .fontSize(12)
            .text('An in-depth analysis of organizational performance, project allocation, and resource optimization metrics.', 60, 320, { width: 300, lineGap: 4 });

        // Decorative Line
        doc.moveTo(60, 380).lineTo(120, 380).strokeColor(colors.primary).lineWidth(3).stroke();

        // Meta Info Container
        const metaY = 550;
        doc.rect(60, metaY, 480, 160).fill(colors.bg);
        
        // Details inside meta
        this._drawMetaItem(doc, 90, metaY + 30, 'Organization', 'Caldim Engineering', colors);
        this._drawMetaItem(doc, 90, metaY + 80, 'Reporting Period', `${from ? format(from, 'MMM d, yyyy') : 'All Time'} – ${to ? format(to, 'MMM d, yyyy') : format(now, 'MMM d, yyyy')}`, colors);
        this._drawMetaItem(doc, 320, metaY + 30, 'Report ID', `ERP-${format(now, 'yyyyMM')}-092`, colors);
        this._drawMetaItem(doc, 320, metaY + 80, 'Generated On', format(now, 'MMMM d, yyyy'), colors);

        // Footer Page 1
        this._addPageFooter(doc, 1, 3, colors, 'System Generated Confidential Report');

        // ════════════════════════════════════════════════════════════════════════════
        // PAGE 2 — EXECUTIVE DASHBOARD
        // ════════════════════════════════════════════════════════════════════════════
        doc.addPage();
        this._addPageHeader(doc, 'Executive Insights Dashboard', colors);

        // KPI Section
        const kpiY = 100;
        const col1 = 50, col2 = 230, col3 = 410;
        const kpiWidth = 170, kpiHeight = 90;

        const complianceRate = complianceStats.total > 0 ? ((complianceStats.approved / complianceStats.total) * 100).toFixed(0) : '0';
        const avgHours = stats.uniqueEmployees.length > 0 ? (stats.totalHours / stats.uniqueEmployees.length).toFixed(1) : '0';

        this._drawPremiumKPICard(doc, col1, kpiY, kpiWidth, kpiHeight, 'Log Volume', `${stats.totalHours.toLocaleString()}h`, 'Total hours approved', colors);
        this._drawPremiumKPICard(doc, col2, kpiY, kpiWidth, kpiHeight, 'Compliance', `${complianceRate}%`, 'Submission accuracy', colors);
        this._drawPremiumKPICard(doc, col3, kpiY, kpiWidth, kpiHeight, 'Avg. Velocity', `${avgHours}h`, 'Hours / Employee / Period', colors);

        // Charts Section
        doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(14).text('Departmental Distribution', 50, 230);
        
        // Mini Bar Chart for Departments
        let barY = 260;
        deptStats.slice(0, 5).forEach((dept, i) => {
            const maxH = deptStats[0].totalHours || 1;
            const barWidth = (dept.totalHours / maxH) * 300;
            
            doc.fillColor(colors.textMuted).font('Helvetica').fontSize(10).text(dept._id || 'General', 50, barY);
            doc.rect(150, barY - 4, 300, 12).fill(colors.bg);
            doc.rect(150, barY - 4, barWidth, 12).fill(colors.primary);
            doc.fillColor(colors.textMain).font('Helvetica-Bold').text(`${dept.totalHours.toFixed(0)}h`, 460, barY);
            barY += 28;
        });

        // Project Breakdown
        doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(14).text('Project Allocation Focus', 50, 430);
        let projY = 460;
        projectData.slice(0, 5).forEach((proj, i) => {
            doc.rect(50, projY, 500, 40).fill(i % 2 === 0 ? colors.bg : colors.surface);
            
            const pName = proj.project?.name || 'Unknown Project';
            const budget = proj.project?.budgetHours || 0;
            const util = budget > 0 ? Math.round((proj.totalHours / budget) * 100) : 0;
            
            doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(10).text(pName, 65, projY + 10);
            if (budget > 0) {
                doc.fillColor(colors.textMuted).font('Helvetica').fontSize(8).text(`Budget: ${budget}h | Util: ${util}%`, 65, projY + 22);
            }
            
            doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).text(`${proj.totalHours.toLocaleString()} hrs`, 450, projY + 15, { align: 'right', width: 80 });
            projY += 40;
        });

        // Smart Insight Box
        doc.roundedRect(50, 700, 500, 70, 8).fill(colors.primary);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('STRATEGIC INSIGHT', 70, 715);
        doc.font('Helvetica').fontSize(10).text(`Organization is performing at ${complianceRate}% compliance. Top focus is currently ${projectData[0]?.project?.name || 'main projects'}.`, 70, 735, { width: 460 });

        this._addPageFooter(doc, 2, 3, colors);

        // ════════════════════════════════════════════════════════════════════════════
        // PAGE 3 — RESOURCE PERFORMANCE (STRICTLY TOP 10)
        // ════════════════════════════════════════════════════════════════════════════
        doc.addPage();
        this._addPageHeader(doc, 'Resource Utilization Analysis', colors);

        doc.fillColor(colors.textMuted).font('Helvetica').fontSize(10).text('Detailed look at the top contributors and their relative impact during this period.', 50, 95);

        // Table Header
        const tableTop = 130;
        doc.rect(50, tableTop, 500, 30).fill(colors.textMain);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
        doc.text('Employee Name', 65, tableTop + 11);
        doc.text('ID', 220, tableTop + 11);
        doc.text('Department', 300, tableTop + 11);
        doc.text('Logged', 430, tableTop + 11);
        doc.text('Status', 500, tableTop + 11);

        // Table Rows (STRICT Top 10 to guarantee single page)
        let rowY = tableTop + 30;
        const top10 = employeeData.slice(0, 10);
        
        top10.forEach((emp, i) => {
            doc.fillColor(i % 2 === 0 ? colors.bg : colors.surface).rect(50, rowY, 500, 45).fill();
            
            doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(10).text(emp.user?.name || 'User', 65, rowY + 18);
            doc.fillColor(colors.textMuted).font('Helvetica').fontSize(9).text(emp.user?.employeeId || '-', 220, rowY + 18);
            doc.text(emp.user?.department || '—', 300, rowY + 18);
            doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).text(`${emp.totalHours.toFixed(1)}h`, 430, rowY + 18);
            
            // Dummy compliance pill
            doc.rect(495, rowY + 16, 50, 14).fill(colors.success);
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('ACTIVE', 495, rowY + 19, { width: 50, align: 'center' });
            
            rowY += 45;
        });

        // Summary Note at bottom
        doc.fillColor(colors.textMuted).font('Helvetica-Oblique').fontSize(9).text('* Only top 10 performers are displayed. See the full digital dashboard for complete records.', 50, rowY + 20);

        this._addPageFooter(doc, 3, 3, colors);

        // Finalize the PDF
        doc.end();
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    _addPageHeader(doc, title, colors) {
        doc.rect(0, 0, doc.page.width, 70).fill(colors.surface);
        doc.fillColor(colors.primary).rect(50, 60, 40, 4).fill();
        doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(20).text(title, 50, 35);
        doc.moveTo(0, 70).lineTo(doc.page.width, 70).strokeColor(colors.border).lineWidth(1).stroke();
    }

    _addPageFooter(doc, current, total, colors, extra = 'CALTIMS Enterprise Intelligence') {
        doc.moveTo(50, doc.page.height - 60).lineTo(550, doc.page.height - 60).strokeColor(colors.border).lineWidth(1).stroke();
        doc.fillColor(colors.textMuted).font('Helvetica').fontSize(8);
        doc.text(extra, 50, doc.page.height - 45);
        doc.text(`Page ${current} of ${total}`, 50, doc.page.height - 45, { align: 'right', width: 500 });
    }

    _drawMetaItem(doc, x, y, label, value, colors) {
        doc.fillColor(colors.textMuted).font('Helvetica').fontSize(9).text(label.toUpperCase(), x, y);
        doc.fillColor(colors.textMain).font('Helvetica-Bold').fontSize(11).text(value, x, y + 15);
    }

    _drawPremiumKPICard(doc, x, y, w, h, title, value, sub, colors) {
        doc.roundedRect(x, y, w, h, 12).fill(colors.surface);
        doc.roundedRect(x, y, w, h, 12).strokeColor(colors.border).lineWidth(1).stroke();
        
        doc.fillColor(colors.textMuted).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), x + 15, y + 15);
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(22).text(value, x + 15, y + 30);
        doc.fillColor(colors.textMuted).font('Helvetica').fontSize(8).text(sub, x + 15, y + 60, { width: w - 30 });
    }
}

module.exports = new PDFGeneratorService();
