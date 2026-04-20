'use strict';

const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const puppeteer = require('puppeteer');
const payslipTemplateService = require('../payroll/payslipTemplate.service');

class PDFGeneratorService {
    constructor() {
        this.browser = null;
    }

    async _getBrowser() {
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
            });
        }
        return this.browser;
    }

    async _renderHtmlToPdf(payroll, settings = {}, customHtml = null) {
        const browser = await this._getBrowser();
        const page = await browser.newPage();
        try {
            let html = '';
            if (customHtml) {
                html = customHtml;
            } else {
                const template = await payslipTemplateService.getDefaultTemplate(payroll.companyId);
                const templateData = payslipTemplateService.prepareDataForTemplate(payroll, settings);
                html = payslipTemplateService.renderTemplate(template.htmlContent, templateData, template.backgroundImageUrl);
            }
            await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
            await page.addStyleTag({
                content: `
                    @page { size: A4; margin: 0; }
                    html, body {
                        height: 297mm; overflow: hidden;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background-color: white !important;
                        margin: 0 !important; padding: 0 !important;
                    }
                    .payslip-container, .container {
                        margin: 0 auto !important; border: none !important;
                        border-radius: 0 !important; box-shadow: none !important;
                        max-width: 800px !important; width: 100% !important;
                        height: 100% !important;
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                        page-break-before: avoid !important;
                    }
                    .no-print { display: none !important; }
                `
            });
            const pdfBuffer = await page.pdf({
                format: 'A4', printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                preferCSSPageSize: true
            });
            return pdfBuffer;
        } finally {
            await page.close();
        }
    }

    async generatePayslip(res, payroll, settings = {}) {
        try {
            const pdfBuffer = await this._renderHtmlToPdf(payroll, settings);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.setHeader('Content-Disposition',
                `attachment; filename="Payslip-${payroll.employeeInfo.employeeId}-${payroll.month}-${payroll.year}.pdf"`);
            return res.end(pdfBuffer, 'binary');
        } catch (error) {
            console.error('PDF Generation Error:', error);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'Failed to generate PDF' });
            }
        }
    }

    async generatePayslipBuffer(payroll, settings = {}, customHtml = null) {
        return this._renderHtmlToPdf(payroll, settings, customHtml);
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Enterprise Workforce Report  –  clean 2-page professional layout
    // ─────────────────────────────────────────────────────────────────────────
    async generateEnterpriseWorkforceReport(res, data, options) {
        return new Promise((resolve, reject) => {

            const {
                stats           = {},
                projectData     = [],
                employeeData    = [],
                deptStats       = [],
                complianceStats = {},
            } = data || {};
            const { from, to, now } = options;

            // ── Colour tokens ────────────────────────────────────────────
            const C = {
                ink:      '#111827',
                muted:    '#6b7280',
                light:    '#9ca3af',
                rule:     '#e5e7eb',
                accent:   '#4f46e5',
                accentLt: '#eef2ff',
                success:  '#16a34a',
                warning:  '#d97706',
                danger:   '#dc2626',
                rowAlt:   '#f9fafb',
                white:    '#ffffff',
            };

            // ── Layout constants ─────────────────────────────────────────
            const PW   = 595.28;
            const PH   = 841.89;
            const ML   = 44;            // left margin
            const MR   = 44;            // right margin
            const CW   = PW - ML - MR;  // ~507 pts
            const ROW  = 20;            // table body row height
            const TH   = 20;            // table header height
            const FOOT = 36;            // reserved footer height

            // ── Pure helpers ─────────────────────────────────────────────
            const trunc = (s, n) => {
                s = String(s || '—');
                return s.length > n ? s.slice(0, n - 1) + '…' : s;
            };

            const fmtHrs = (n) => {
                const v = parseFloat(n) || 0;
                return v === 0 ? '0' : (v % 1 === 0 ? String(v) : v.toFixed(1));
            };

            const fmtDate = (d) => {
                if (!d) return 'All Time';
                try { return format(new Date(d), 'dd MMM yyyy'); } catch { return String(d); }
            };

            const pct = (part, whole) =>
                whole > 0 ? Math.min(Math.round((part / whole) * 100), 100) : 0;

            // ── Compliance values ────────────────────────────────────────
            const cv = (k) => complianceStats[k.toUpperCase()] || complianceStats[k.toLowerCase()] || 0;
            const cApproved  = cv('approved');
            const cAdminFill = cv('admin_filled');
            const cSubmitted = cv('submitted');
            const cDraft     = cv('draft');
            const cRejected  = cv('rejected');
            const cTotal     = complianceStats.total || (cApproved + cAdminFill + cSubmitted + cDraft + cRejected) || 1;
            const compRate   = pct(cApproved + cAdminFill, cTotal);

            const totalHrs   = parseFloat(stats.totalHours) || 0;
            const totalShts  = stats.totalTimesheets || 0;
            const totalEmps  = (stats.uniqueEmployees || []).length;

            // ── PDFKit bootstrap ─────────────────────────────────────────
            const doc = new PDFDocument({
                size: [PW, PH], margin: 0, bufferPages: true, autoFirstPage: true
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition',
                `attachment; filename="Workforce-Report-${format(now, 'yyyyMMdd')}.pdf"`);
            doc.pipe(res);
            res.on('error', reject);
            doc.on('end', resolve);

            // ────────────────────────────────────────────────────────────
            //  Drawing utilities
            // ────────────────────────────────────────────────────────────

            /** Horizontal rule */
            const rule = (y, color = C.rule, w = 0.4) =>
                doc.moveTo(ML, y).lineTo(PW - MR, y)
                   .strokeColor(color).lineWidth(w).stroke();

            /** Text cell – always single line, clipped to width */
            const cell = (txt, x, y, w, opts = {}) => {
                doc
                  .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
                  .fontSize(opts.size || 8)
                  .fillColor(opts.color || C.ink)
                  .text(String(txt ?? '—'), x, y, {
                      width: w,
                      align: opts.align || 'left',
                      lineBreak: false,
                  });
            };

            /** Table header band */
            const drawTHead = (cols, y) => {
                doc.rect(ML, y, CW, TH).fill(C.accent);
                cols.forEach(col => {
                    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.white)
                       .text(col.label.toUpperCase(), col.x, y + 7,
                             { width: col.w, align: col.align || 'left', lineBreak: false });
                });
                return y + TH;
            };

            /** Mini horizontal progress bar */
            const bar = (x, y, totalW, fillPct, barColor) => {
                const H = 5;
                const BY = y + (ROW - H) / 2;
                doc.rect(x, BY, totalW, H).fill(C.rule);
                const filled = Math.max(Math.round(totalW * Math.min(fillPct, 100) / 100), 1);
                if (fillPct > 0) doc.rect(x, BY, filled, H).fill(barColor);
            };

            // ════════════════════════════════════════════════════════════
            //  PAGE 1 – KPIs + Compliance + Top Employees
            // ════════════════════════════════════════════════════════════
            doc.rect(0, 0, PW, PH).fill(C.white);

            // ── Header band ──────────────────────────────────────────────
            const HBAR = 48;
            doc.rect(0, 0, PW, HBAR).fill(C.accent);
            doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white)
               .text('Workforce Productivity Report', ML, 14, { lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor('#c7d2fe')
               .text(`${fmtDate(from)}  –  ${fmtDate(to)}`, 0, 20,
                     { align: 'right', width: PW - MR, lineBreak: false });

            let y = HBAR + 10;

            // ── Meta line ────────────────────────────────────────────────
            doc.font('Helvetica').fontSize(7).fillColor(C.light)
               .text(`Generated  ${format(now, 'dd MMM yyyy, HH:mm')}`, ML, y, { lineBreak: false })
               .text('CALTIMS Enterprise Intelligence', 0, y,
                     { align: 'right', width: PW - MR, lineBreak: false });
            y += 14;
            rule(y); y += 12;

            // ── KPI Cards ────────────────────────────────────────────────
            const kpis = [
                { label: 'Total Hours',      value: fmtHrs(totalHrs) },
                { label: 'Employees',        value: String(totalEmps) },
                { label: 'Timesheets',       value: String(totalShts) },
                { label: 'Compliance Rate',  value: `${compRate}%`   },
            ];

            const KH  = 58;
            const KW  = (CW - 12) / 4;
            const KGP = 4;

            kpis.forEach((kpi, i) => {
                const kx = ML + i * (KW + KGP);
                doc.rect(kx, y, KW, KH).fill(C.accentLt);
                doc.rect(kx, y, 3, KH).fill(C.accent);
                doc.font('Helvetica-Bold').fontSize(22).fillColor(C.accent)
                   .text(kpi.value, kx + 10, y + 8, { width: KW - 14, lineBreak: false });
                doc.font('Helvetica').fontSize(7).fillColor(C.muted)
                   .text(kpi.label.toUpperCase(), kx + 10, y + 38,
                         { width: KW - 14, lineBreak: false, characterSpacing: 0.3 });
            });
            y += KH + 16;

            // ── Compliance Section ────────────────────────────────────────
            rule(y); y += 12;
            doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink)
               .text('Compliance Overview', ML, y); y += 14;

            const compRows = [
                { label: 'Approved',  val: cApproved,  color: C.success },
                { label: 'Admin Resol.', val: cAdminFill, color: C.accent },
                { label: 'Submitted', val: cSubmitted,  color: C.warning  },
                { label: 'Draft',     val: cDraft,      color: '#94a3b8'  },
                { label: 'Rejected',  val: cRejected,   color: C.danger   },
            ];

            // Segmented bar
            const SEG_H = 9;
            let bx = ML;
            compRows.forEach(cr => {
                const w = Math.round(CW * (cr.val / cTotal));
                if (w > 0) { doc.rect(bx, y, w, SEG_H).fill(cr.color); bx += w; }
            });
            y += SEG_H + 6;

            // Legend row
            compRows.forEach((cr, i) => {
                const lx = ML + i * (CW / 5);
                doc.rect(lx, y + 1, 7, 7).fill(cr.color);
                doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
                   .text(`${cr.label}  ${cr.val}  (${pct(cr.val, cTotal)}%)`,
                         lx + 11, y + 1, { lineBreak: false });
            });
            y += 18;
            rule(y); y += 14;

            // ── Top Employees Table ───────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink)
               .text('Top Employee Contributors', ML, y); y += 12;

            // Column definitions – x is absolute page position
            const E_COLS = [
                { label: '#',           x: ML,       w: 18,  align: 'center' },
                { label: 'Employee',    x: ML + 22,  w: 140, align: 'left'   },
                { label: 'Emp. ID',     x: ML + 166, w: 68,  align: 'left'   },
                { label: 'Department',  x: ML + 238, w: 118, align: 'left'   },
                { label: 'Weeks',       x: ML + 360, w: 38,  align: 'center' },
                { label: 'Hours',       x: ML + 402, w: 61,  align: 'right'  },
            ];

            y = drawTHead(E_COLS, y);

            const empTop = employeeData.slice(0, 10);
            if (empTop.length === 0) {
                doc.rect(ML, y, CW, ROW).fill(C.white);
                cell('No employee data for the selected period.', ML + 6, y + 6, CW - 12,
                     { color: C.muted, align: 'center' });
                y += ROW;
            } else {
                empTop.forEach((emp, i) => {
                    const bg = i % 2 === 0 ? C.white : C.rowAlt;
                    doc.rect(ML, y, CW, ROW).fill(bg);

                    cell(i + 1,                                        E_COLS[0].x, y + 6, E_COLS[0].w, { align: 'center', color: C.muted });
                    cell(trunc(emp.user?.name, 22),                    E_COLS[1].x, y + 6, E_COLS[1].w, { bold: true });
                    cell(trunc(emp.user?.employeeId || '—', 12),       E_COLS[2].x, y + 6, E_COLS[2].w, { color: C.muted });
                    cell(trunc(emp.user?.department || '—', 18),       E_COLS[3].x, y + 6, E_COLS[3].w);
                    cell(emp.timesheetCount || 0,                       E_COLS[4].x, y + 6, E_COLS[4].w, { align: 'center', color: C.muted });
                    cell(`${fmtHrs(emp.totalHours)} hrs`,               E_COLS[5].x, y + 6, E_COLS[5].w, { bold: true, align: 'right', color: C.accent });

                    y += ROW;
                });
            }

            this._engFooter(doc, 1, 2, now, C, PW, PH);

            // ════════════════════════════════════════════════════════════
            //  PAGE 2 – Projects + Departments
            // ════════════════════════════════════════════════════════════
            doc.addPage();
            doc.rect(0, 0, PW, PH).fill(C.white);

            // Header band
            doc.rect(0, 0, PW, HBAR).fill(C.accent);
            doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white)
               .text('Project & Department Breakdown', ML, 14, { lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor('#c7d2fe')
               .text(`${fmtDate(from)}  –  ${fmtDate(to)}`, 0, 20,
                     { align: 'right', width: PW - MR, lineBreak: false });

            y = HBAR + 18;

            // ── Project Utilization ───────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink)
               .text('Project Utilization', ML, y); y += 12;

            const P_COLS = [
                { label: '#',         x: ML,       w: 18,  align: 'center' },
                { label: 'Project',   x: ML + 22,  w: 158, align: 'left'   },
                { label: 'Code',      x: ML + 184, w: 50,  align: 'left'   },
                { label: 'Budget',    x: ML + 238, w: 52,  align: 'right'  },
                { label: 'Logged',    x: ML + 294, w: 52,  align: 'right'  },
                { label: 'Util %',    x: ML + 350, w: 40,  align: 'right'  },
                { label: 'Progress',  x: ML + 396, w: 111, align: 'left'   },
            ];

            y = drawTHead(P_COLS, y);

            const projTop = projectData.slice(0, 12);
            if (projTop.length === 0) {
                doc.rect(ML, y, CW, ROW).fill(C.white);
                cell('No project data for the selected period.', ML + 6, y + 6, CW - 12,
                     { color: C.muted, align: 'center' });
                y += ROW;
            } else {
                projTop.forEach((proj, i) => {
                    const bg     = i % 2 === 0 ? C.white : C.rowAlt;
                    const budget = parseFloat(proj.project?.budgetHours) || 0;
                    const logged = parseFloat(proj.totalHours) || 0;
                    const util   = budget > 0 ? Math.round((logged / budget) * 100) : null;
                    const barClr = util === null ? C.accent
                                 : util > 100    ? C.danger
                                 : util > 80     ? C.warning
                                 : C.success;

                    doc.rect(ML, y, CW, ROW).fill(bg);

                    cell(i + 1,                             P_COLS[0].x, y + 6, P_COLS[0].w, { align: 'center', color: C.muted });
                    cell(trunc(proj.project?.name, 26),     P_COLS[1].x, y + 6, P_COLS[1].w, { bold: true });
                    cell(trunc(proj.project?.code || '—', 8), P_COLS[2].x, y + 6, P_COLS[2].w, { color: C.muted });
                    cell(budget > 0 ? `${fmtHrs(budget)}h` : '—', P_COLS[3].x, y + 6, P_COLS[3].w, { align: 'right' });
                    cell(`${fmtHrs(logged)}h`,              P_COLS[4].x, y + 6, P_COLS[4].w, { align: 'right', bold: true });

                    // Util % coloured
                    const utilTxt = util !== null ? `${Math.min(util, 999)}%` : '—';
                    const utilClr = util === null ? C.muted
                                  : util > 100   ? C.danger
                                  : util > 80    ? C.warning
                                  : C.success;
                    cell(utilTxt, P_COLS[5].x, y + 6, P_COLS[5].w, { align: 'right', color: utilClr, bold: util !== null });

                    // Progress bar
                    if (util !== null) {
                        bar(P_COLS[6].x, y, P_COLS[6].w - 4, util, barClr);
                    }

                    y += ROW;
                });
            }

            // ── Department Breakdown ──────────────────────────────────────
            y += 16;
            if (y < PH - FOOT - 80) {
                rule(y); y += 14;
                doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink)
                   .text('Departmental Contribution', ML, y); y += 12;

                // Sub-header labels at fixed positions
                const D_NAME_W  = 148;
                const D_EMP_X   = ML + D_NAME_W + 8;
                const D_HRS_X   = D_EMP_X + 44;
                const D_PCT_X   = D_HRS_X + 56;
                const D_BAR_X   = D_PCT_X + 38;
                const D_BAR_W   = PW - MR - D_BAR_X - 2;

                doc.font('Helvetica-Bold').fontSize(7).fillColor(C.light)
                   .text('DEPARTMENT',   ML,         y, { lineBreak: false })
                   .text('EMP',          D_EMP_X,    y, { width: 40, align: 'right', lineBreak: false })
                   .text('HOURS',        D_HRS_X,    y, { width: 52, align: 'right', lineBreak: false })
                   .text('SHARE',        D_PCT_X,    y, { width: 34, align: 'right', lineBreak: false })
                   .text('CONTRIBUTION BAR', D_BAR_X, y, { lineBreak: false });
                y += 10;
                rule(y, C.rule, 0.3); y += 4;

                const totalDH   = deptStats.reduce((s, d) => s + (parseFloat(d.totalHours) || 0), 0) || 1;
                const sortedD   = [...deptStats].sort((a, b) =>
                    (parseFloat(b.totalHours) || 0) - (parseFloat(a.totalHours) || 0));

                sortedD.forEach((dept, i) => {
                    if (y > PH - FOOT - ROW) return;
                    const bg   = i % 2 === 0 ? C.white : C.rowAlt;
                    const hrs  = parseFloat(dept.totalHours) || 0;
                    const pctD = ((hrs / totalDH) * 100).toFixed(1);
                    const empC = dept.employeeCount || 0;

                    doc.rect(ML, y, CW, ROW).fill(bg);

                    cell(trunc(dept._id || 'Unassigned', 22), ML,       y + 6, D_NAME_W, { bold: true });
                    cell(String(empC),      D_EMP_X,    y + 6, 40, { align: 'right', color: C.muted });
                    cell(`${fmtHrs(hrs)}h`, D_HRS_X,    y + 6, 52, { align: 'right' });
                    cell(`${pctD}%`,        D_PCT_X,    y + 6, 34, { align: 'right', color: C.muted });

                    bar(D_BAR_X, y, D_BAR_W, parseFloat(pctD), C.accent);

                    y += ROW;
                });

                if (sortedD.length === 0) {
                    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
                       .text('No department data available.', ML, y + 6);
                }
            }

            this._engFooter(doc, 2, 2, now, C, PW, PH);
            doc.end();
        });
    }

    /** Footer for enterprise reports */
    _engFooter(doc, current, total, now, C, PW, PH) {
        const ML = 44;
        const MR = 44;
        doc.moveTo(ML, PH - 28).lineTo(PW - MR, PH - 28)
           .strokeColor(C.rule).lineWidth(0.4).stroke();
        doc.font('Helvetica').fontSize(7).fillColor(C.light)
           .text('CALTIMS Enterprise Intelligence  ·  Confidential', ML, PH - 20, { lineBreak: false })
           .text(`Page ${current} of ${total}`, 0, PH - 20,
                 { align: 'right', width: PW - MR, lineBreak: false });
    }

    /** Legacy footer helper (payslip pages) */
    _addPageFooter(doc, current, total, colors, extra = 'CALTIMS Enterprise Intelligence') {
        const PH = doc.page.height;
        doc.moveTo(50, PH - 60).lineTo(550, PH - 60)
           .strokeColor(colors.border || '#e2e8f0').lineWidth(1).stroke();
        doc.fillColor(colors.textMuted || '#64748b').font('Helvetica').fontSize(8)
           .text(extra, 50, PH - 45)
           .text(`Page ${current} of ${total}`, 50, PH - 45, { align: 'right', width: 500 });
    }
}

module.exports = new PDFGeneratorService();