'use strict';

const PDFDocument = require('pdfkit');

class PdfGeneratorService {
    /**
     * Generates a Condensed 3-page Enterprise Workforce Report with an Attractive Slate & Emerald Theme
     */
    async generateEnterpriseWorkforceReport(res, data, dateOptions) {
        const { from, to, now } = dateOptions;
        const { stats, projectData, leaveData, weeklyTrend, employeeData, deptStats, complianceStats } = data;

        const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Workforce-Report-${now.toISOString().split('T')[0]}.pdf"`);
        doc.pipe(res);

        // --- Attractive & Professional Color Palette (Slate & Emerald) ---
        const PAGE_BG = '#F8FAFC';   // Very Light Slate
        const PRIMARY = '#0F172A';   // Slate 900
        const SECONDARY = '#10B981'; // Emerald 500
        const ACCENT = '#34D399';    // Emerald 400
        const CARD_BG = '#FFFFFF';   // Pure White
        const TEXT_MAIN = '#1E293B'; // Slate 800
        const TEXT_MUTE = '#64748B'; // Slate 500
        const WHITE = '#FFFFFF';
        const BORDER = '#E2E8F0';    // Slate 200

        // Page Dimensions
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 50;
        const contentWidth = pageWidth - margin * 2;

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        const periodStr = (from || to) ? `${from ? formatDate(from) : 'Start'} – ${to ? formatDate(to) : 'Present'}` : 'All Time';

        // --- Global Background ---
        const applyBackground = () => {
            doc.rect(0, 0, pageWidth, pageHeight).fill(PAGE_BG);
        };

        // --- Component Helpers ---
        const drawHeader = (title) => {
            doc.rect(0, 0, pageWidth, 100).fill(PRIMARY);
            doc.fillColor(WHITE).fontSize(22).font('Helvetica-Bold').text(title, margin, 35);
            doc.fontSize(10).font('Helvetica').text(`Period: ${periodStr}`, margin, 65);
            doc.text(`Generated: ${formatDate(now)}`, 0, 65, { align: 'right', width: pageWidth - margin });
            return 120;
        };

        const drawFooter = () => {
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.rect(0, pageHeight - 40, pageWidth, 40).fill(WHITE);
                doc.fillColor(TEXT_MUTE).fontSize(8).font('Helvetica');
                doc.text('CALTIMS Workforce Intelligence | Professional Report', margin, pageHeight - 25);
                doc.text(`Page ${i + 1} of ${range.count}`, 0, pageHeight - 25, { align: 'right', width: pageWidth - margin });
            }
        };

        const drawCard = (x, y, w, h, title, value) => {
            doc.rect(x, y, w, h).fill(CARD_BG).strokeColor(BORDER).lineWidth(1).stroke();
            doc.fillColor(SECONDARY).fontSize(20).font('Helvetica-Bold').text(value, x, y + h / 2 - 10, { align: 'center', width: w });
            doc.fillColor(TEXT_MUTE).fontSize(9).font('Helvetica').text(title, x, y + h / 2 + 15, { align: 'center', width: w });
        };

        const drawTable = (headers, rows, startY, colWidths) => {
            let y = startY;
            const rowH = 25;
            doc.rect(margin, y, contentWidth, rowH).fill(PRIMARY);
            let x = margin;
            headers.forEach((h, i) => {
                doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold').text(h.toUpperCase(), x + 10, y + 8, { width: colWidths[i] - 20 });
                x += colWidths[i];
            });
            y += rowH;

            rows.forEach((row, ri) => {
                doc.rect(margin, y, contentWidth, rowH).fill(ri % 2 === 0 ? CARD_BG : PAGE_BG).strokeColor(BORDER).lineWidth(0.5).stroke();
                let cx = margin;
                row.forEach((cell, ci) => {
                    doc.fillColor(TEXT_MAIN).fontSize(9).font('Helvetica').text(String(cell ?? '—'), cx + 10, y + 8, { width: colWidths[ci] - 20 });
                    cx += colWidths[ci];
                });
                y += rowH;
            });
            return y;
        };

        const drawProgressBar = (x, y, w, h, percentage, color) => {
            doc.rect(x, y, w, h).fill(BORDER);
            doc.rect(x, y, w * (Math.min(100, percentage) / 100), h).fill(color);
            doc.fillColor(TEXT_MAIN).fontSize(8).font('Helvetica-Bold').text(`${Math.round(percentage)}%`, x + w + 10, y + 1);
        };

        // ==========================================
        // PAGE 1: Cover & Dashboard
        // ==========================================
        applyBackground();
        doc.rect(0, 0, pageWidth, 300).fill(PRIMARY);

        // Add a subtle emerald strip for style
        doc.rect(0, 295, pageWidth, 5).fill(SECONDARY);

        doc.fillColor(WHITE).fontSize(40).font('Helvetica-Bold').text('CALTIMS', margin, 100);
        doc.fontSize(20).text('Enterprise Workforce Report', margin, 150);

        doc.fontSize(12).font('Helvetica').text(`Organization: Caldim Engineering`, margin, 210);
        doc.text(`Period: ${periodStr}`, margin, 230);

        let y = 330;
        doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text('Executive Dashboard', margin, y);
        y += 30;

        const totHrs = stats.totalHours || 0;
        const actEmp = stats.uniqueEmployees?.length || 0;
        const cardW = (contentWidth - 20) / 3;

        drawCard(margin, y, cardW, 70, 'Total Hours', `${totHrs.toFixed(1)}h`);
        drawCard(margin + cardW + 10, y, cardW, 70, 'Active Employees', actEmp.toString());
        drawCard(margin + cardW * 2 + 20, y, cardW, 70, 'Projects Active', projectData.length.toString());

        y += 85;
        drawCard(margin, y, cardW, 70, 'Timesheets', stats.totalTimesheets.toString());
        drawCard(margin + cardW + 10, y, cardW, 70, 'Avg Hours/Emp', `${actEmp > 0 ? (totHrs / actEmp).toFixed(1) : 0}h`);
        const compRate = complianceStats?.total ? ((complianceStats.approved / complianceStats.total) * 100).toFixed(0) : 100;
        drawCard(margin + cardW * 2 + 20, y, cardW, 70, 'Compliance', `${compRate}%`);

        y += 110;
        doc.rect(margin, y, contentWidth, 120).fill(CARD_BG).strokeColor(BORDER).lineWidth(1).stroke();
        doc.rect(margin, y, 5, 120).fill(SECONDARY); // Accent bar
        doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Strategic Insights', margin + 20, y + 20);
        doc.fillColor(TEXT_MAIN).fontSize(10).font('Helvetica');
        let insightY = y + 50;
        if (projectData[0]) {
            doc.text(`• ${projectData[0].project?.name} accounts for ${((projectData[0].totalHours / totHrs) * 100).toFixed(0)}% of total effort.`, margin + 25, insightY);
            insightY += 20;
        }
        if (deptStats[0]) {
            doc.text(`• ${deptStats[0]._id} department leads with ${deptStats[0].totalHours.toFixed(0)} total hours.`, margin + 25, insightY);
            insightY += 20;
        }
        doc.text(`• Workforce compliance is maintained at ${compRate}%.`, margin + 25, insightY);

        // ==========================================
        // PAGE 2: Performance Analysis
        // ==========================================
        doc.addPage();
        applyBackground();
        y = drawHeader('Performance Analysis');

        // Project Table
        doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Top Resource Allocations', margin, y);
        y += 25;
        const projRows = projectData.slice(0, 8).map(p => [
            p.project?.name || 'Unknown',
            p.project?.code || '-',
            `${p.totalHours.toFixed(1)}h`,
            `${((p.totalHours / Math.max(1, totHrs)) * 100).toFixed(0)}%`
        ]);
        y = drawTable(['Project', 'Code', 'Hours', 'Effort %'], projRows, y, [contentWidth * 0.4, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2]);

        y += 40;
        // Employee Performance Table
        doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Key Contributors', margin, y);
        y += 25;
        const empRows = employeeData.slice(0, 10).map((e, i) => [
            (i + 1).toString(),
            e.user?.name || 'Unknown',
            e.user?.department || '-',
            `${e.totalHours.toFixed(1)}h`
        ]);
        drawTable(['Rank', 'Employee', 'Department', 'Hours Logged'], empRows, y, [contentWidth * 0.1, contentWidth * 0.4, contentWidth * 0.3, contentWidth * 0.2]);

        // ==========================================
        // PAGE 3: Workforce Intelligence
        // ==========================================
        doc.addPage();
        applyBackground();
        y = drawHeader('Workforce Intelligence');

        // Dept Workload
        doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Departmental Workload', margin, y);
        y += 25;
        const maxDeptHrs = Math.max(...deptStats.map(d => d.totalHours), 1);
        deptStats.slice(0, 5).forEach(d => {
            doc.fillColor(TEXT_MAIN).fontSize(9).font('Helvetica').text(d._id || 'Unassigned', margin, y + 2, { width: 100 });
            drawProgressBar(margin + 110, y, 300, 12, (d.totalHours / maxDeptHrs) * 100, SECONDARY);
            y += 25;
        });

        y += 20;
        // Weekly Trend
        doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Productivity Trends', margin, y);
        y += 25;
        const trendRows = weeklyTrend.slice(-6).map(w => [
            formatDate(w.week),
            `${w.totalHours.toFixed(1)}h`,
            w.employeeCount.toString(),
            `${(w.totalHours / Math.max(1, w.employeeCount)).toFixed(1)}h`
        ]);
        y = drawTable(['Week Commencing', 'Hours', 'Team', 'Avg/Emp'], trendRows, y, [contentWidth * 0.3, contentWidth * 0.25, contentWidth * 0.2, contentWidth * 0.25]);

        y += 40;
        // Summary Section
        doc.rect(margin, y, contentWidth, 100).fill(CARD_BG).strokeColor(BORDER).lineWidth(1).stroke();
        doc.rect(margin, y, 5, 100).fill(SECONDARY);
        doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('Intelligence Conclusion', margin + 20, y + 15);
        doc.fillColor(TEXT_MAIN).fontSize(9).font('Helvetica');
        const summaryText = `This report indicates a ${compRate}% compliance rate with ${totHrs.toFixed(1)} total hours logged across ${projectData.length} projects. ${deptStats[0]?._id} remains the highest performing department. Employee utilization remains stable with an average of ${(totHrs / Math.max(1, actEmp)).toFixed(1)} hours per person.`;
        doc.text(summaryText, margin + 25, y + 40, { width: contentWidth - 45 });

        // Finalize
        drawFooter();
        doc.end();
    }
}

module.exports = new PdfGeneratorService();
