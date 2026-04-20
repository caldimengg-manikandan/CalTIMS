'use strict';

const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const { prisma } = require('../../config/database');
const { TIMESHEET_STATUS } = require('../../constants');

const logger = require('../utils/logger');

// ── Transporter Singleton ───────────────────────────────────────────────────
let transporter;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.error('SMTP credentials not configured.');
    throw new Error('SMTP credentials not configured.');
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// ── Report Data Fetcher ──────────────────────────────────────────────────────
async function buildReportData(reportType, companyName = 'CALTIMS', projectIds = []) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 90);

  let reportTitle;
  const where = { workDate: { gte: from, lte: now } };

  switch (reportType) {
    case 'approved':
      where.status = 'APPROVED';
      reportTitle = 'Approved Timesheets';
      break;
    case 'rejected':
      where.status = 'REJECTED';
      reportTitle = 'Rejected Timesheets';
      break;
    case 'pending':
      where.status = 'SUBMITTED';
      reportTitle = 'Pending (Submitted) Timesheets';
      break;
    default:
      where.status = { not: 'DRAFT' };
      reportTitle = 'All Timesheets (Full Report)';
      break;
  }

  if (projectIds && projectIds.length > 0) {
    where.projectId = { in: projectIds };
  }

  const timesheets = await prisma.timesheet.findMany({
    where,
    include: {
      employee: { include: { user: { select: { name: true, email: true } } } },
      project: { select: { name: true, code: true } },
    },
    orderBy: { workDate: 'desc' },
    take: 100,
  });

  // Normalize shape for HTML/PDF builders
  const normalizedTimesheets = timesheets.map(ts => ({
    userId: { name: ts.employee?.user?.name || 'Unknown', employeeId: ts.employee?.employeeCode || '', department: '' },
    weekStartDate: ts.workDate,
    totalHours: ts.hours,
    status: ts.status?.toLowerCase(),
    rows: [{ projectId: ts.project }],
  }));

  return { timesheets: normalizedTimesheets, reportTitle, companyName, generatedAt: now.toISOString(), projectIds };
}

// ── HTML Email Builder ───────────────────────────────────────────────────────
function buildEmailHTML({ timesheets, reportTitle, companyName, generatedAt }) {
  const date = new Date(generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const rows = timesheets.map((ts) => {
    const name = ts.userId?.name || 'Unknown';
    const empId = ts.userId?.employeeId || '—';
    const dept = ts.userId?.department || '—';
    const week = ts.weekStartDate ? new Date(ts.weekStartDate).toLocaleDateString('en-IN') : '—';
    const hours = ts.totalHours ?? 0;
    const status = ts.status || '—';
    const statusColor = status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#f59e0b';

    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 14px;font-size:13px;color:#1e293b;font-weight:600">${name} <span style="color:#94a3b8;font-size:11px">#${empId}</span></td>
        <td style="padding:10px 14px;font-size:13px;color:#475569">${dept}</td>
        <td style="padding:10px 14px;font-size:13px;color:#475569">${week}</td>
        <td style="padding:10px 14px;font-size:13px;color:#6366f1;font-weight:700;text-align:center">${hours}h</td>
        <td style="padding:10px 14px;text-align:center">
          <span style="background:${statusColor}20;color:${statusColor};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:capitalize">${status}</span>
        </td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${reportTitle}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:700px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">${companyName}</h1>
      <p style="margin:6px 0 0;color:#e0e7ff;font-size:14px">${reportTitle}</p>
    </div>
    <!-- Meta -->
    <div style="padding:20px 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#64748b">Generated: <strong>${date} (IST)</strong> &nbsp;|&nbsp; Records: <strong>${timesheets.length}</strong></p>
    </div>
    <!-- Table -->
    <div style="padding:24px 40px">
      ${timesheets.length === 0
        ? '<p style="text-align:center;color:#94a3b8;padding:40px 0">No records found for the selected period.</p>'
        : `<table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Employee</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Department</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Week</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Hours</th>
                <th style="padding:10px 14px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
      }
    </div>
    <!-- Footer -->
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">${companyName} &mdash; Automated Timesheet Report &mdash; Do not reply to this email</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Reset Password Email Builder ───────────────────────────────────────────
function buildResetPasswordHTML({ resetLink, name, companyName }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Reset Your Password</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:550px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">${companyName}</h1>
    </div>
    <div style="padding:40px;text-align:center">
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:700">Password Reset Request</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6">
        Hello ${name},<br>
        We received a request to reset your password. Click the button below to choose a new one. This link will expire in 10 minutes.
      </p>
      <a href="${resetLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(99,102,241,0.3)">
        Reset Password
      </a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:13px">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">${companyName} &mdash; Account Security</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Welcome Email Builder ──────────────────────────────────────────────────
function buildWelcomeEmailHTML({ name, email, password, portalLink, companyName }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Welcome to ${companyName}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:550px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 40px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">${companyName}</h1>
      <p style="margin:6px 0 0;color:#dcfce7;font-size:14px">Welcome to the Team!</p>
    </div>
    <div style="padding:40px">
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:700">Hello ${name},</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6">
        Your account has been created successfully. You can now log in to the employee portal using the credentials below:
      </p>
      
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px">
        <p style="margin:0 0 12px;font-size:14px;color:#64748b"><strong>Email:</strong> ${email}</p>
        <p style="margin:0;font-size:14px;color:#64748b"><strong>Password:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;color:#1e293b;font-weight:700">${password}</code></p>
      </div>

      <div style="text-align:center">
        <a href="${portalLink}" style="display:inline-block;background:#22c55e;color:#fff;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(34,197,94,0.3)">
          Login to Portal
        </a>
      </div>

      <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;text-align:center">
        We recommend changing your password after your first login.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">${companyName} &mdash; Employee Onboarding</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Notification Email Builder ──────────────────────────────────────────────
function buildNotificationHTML({ title, message, companyName, actionLink, actionLabel }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:550px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">${companyName}</h1>
    </div>
    <div style="padding:40px;text-align:center">
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:700">${title}</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6">
        ${message}
      </p>
      ${actionLink ? `
      <a href="${actionLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(99,102,241,0.3)">
        ${actionLabel || 'View Details'}
      </a>` : ''}
    </div>
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">${companyName} &mdash; Notification System</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Public API ───────────────────────────────────────────────────────────────
const emailService = {
  /**
   * Send report email to a list of recipient email addresses.
   * @param {string[]} recipientEmails
   * @param {string} reportType
   * @param {string} companyName
   * @param {string[]} projectIds
   * @param {string} format
   */
  async sendReportEmail(recipientEmails, reportType, companyName, projectIds = [], format = 'HTML') {
    const transporter = getTransporter(); // throws if not configured
    const data = await buildReportData(reportType, companyName, projectIds);
    const html = buildEmailHTML(data);
    const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
    const filenameBase = `${data.reportTitle.replace(/[^a-z0-9]/gi, '_')}_${dateStr}`;
    
    let attachments = [];

    if (format === 'PDF') {
        const { buffer } = await emailService.buildReportPdf(reportType, companyName, projectIds);
        attachments.push({ filename: `${filenameBase}.pdf`, content: buffer, contentType: 'application/pdf' });
    } else if (format === 'CSV' || format === 'Excel') {
        const { buffer, ext, mime } = await emailService.buildReportCsv(reportType, companyName, projectIds, format);
        attachments.push({ filename: `${filenameBase}.${ext}`, content: buffer, contentType: mime });
    }

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmails.join(','),
      subject: `[${companyName}] ${data.reportTitle} — ${new Date().toLocaleDateString('en-IN')}`,
      html,
      attachments
    });

    return { sent: recipientEmails.length, reportTitle: data.reportTitle };
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(userEmail, userName, resetToken, companyName = 'CALTIMS') {
    const transporter = getTransporter();
    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    const html = buildResetPasswordHTML({
      resetLink,
      name: userName,
      companyName
    });

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `[${companyName}] Password Reset Request`,
      html,
    });

    return true;
  },

  /**
   * Send budget exceeded email to Admin and Project Manager
   */
  async sendBudgetExceededEmail(recipientEmails, projectData, companyName = 'CALTIMS') {
    const transporter = getTransporter();
    
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Project Budget Exceeded</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#ef4444,#f87171);padding:32px 40px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">${companyName}</h1>
      <p style="margin:6px 0 0;color:#fee2e2;font-size:14px">Budget Alert</p>
    </div>
    <div style="padding:40px">
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:700">Project Budget Exceeded</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6">
        The project <strong>${projectData.name} (${projectData.code})</strong> has exceeded its allocated budget hours.
      </p>
      <div style="background:#fff5f5;border:1px solid #fee2e2;border-radius:12px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#64748b">Budgeted Hours:</td>
            <td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:700;text-align:right">${projectData.budgetHours} h</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#64748b">Total Hours Logged:</td>
            <td style="padding:4px 0;font-size:14px;color:#ef4444;font-weight:800;text-align:right">${projectData.totalHours.toFixed(2)} h</td>
          </tr>
        </table>
      </div>
      <p style="margin:0;color:#64748b;font-size:14px">
        Please review the project status and adjust allocations if necessary.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">${companyName} &mdash; Project Management System</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmails.join(','),
      subject: `[${companyName}] ALERT: Project Budget Exceeded - ${projectData.name}`,
      html,
    });

    return true;
  },

  /**
   * Build and return report data + HTML preview (no email sent).
   */
  async buildPreview(reportType, companyName, projectIds = []) {
    const data = await buildReportData(reportType, companyName, projectIds);
    return { html: buildEmailHTML(data), recordCount: data.timesheets.length };
  },

  /**
   * Build a PDF buffer from report data using pdfkit.
   */
  async buildReportPdf(reportType, companyName, projectIds = []) {
    const data = await buildReportData(reportType, companyName, projectIds);
    const { timesheets, reportTitle, generatedAt } = data;
    const date = new Date(generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const colors = {
      primary: '#4f46e5',
      textMain: '#0f172a',
      textMuted: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0'
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), reportTitle, recordCount: timesheets.length }));
      doc.on('error', reject);

      // ── Header Section ──
      doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(companyName.toUpperCase(), 40, 25);
      doc.fontSize(10).font('Helvetica').fillColor('#e0e7ff').text(reportTitle, 40, 52);

      // ── Meta Info ──
      doc.fillColor(colors.textMuted).fontSize(9).font('Helvetica');
      doc.text(`Generated: ${date} (IST)   |   Total Records: ${timesheets.length}`, 40, 100);
      doc.moveTo(40, 115).lineTo(doc.page.width - 40, 115).strokeColor(colors.border).lineWidth(1).stroke();

      // ── Table headers ──
      const cols = [40, 170, 300, 380, 450, 520];
      const headers = ['EMPLOYEE', 'DEPARTMENT', 'WEEK', 'HOURS', 'STATUS'];
      let y = 130;

      doc.rect(40, y, doc.page.width - 80, 24).fill(colors.textMain);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, cols[i], y + 8, { width: cols[i + 1] - cols[i] - 4 }));
      y += 24;

      // ── Rows ──
      doc.font('Helvetica').fontSize(9);
      if (timesheets.length === 0) {
        doc.fillColor(colors.textMuted).text('No records found for the selected period.', 40, y + 30, { align: 'center', width: doc.page.width - 80 });
      } else {
        timesheets.forEach((ts, idx) => {
          if (y > doc.page.height - 100) { 
            doc.addPage(); 
            y = 40; 
            // Repeat Header on new page
            doc.rect(40, y, doc.page.width - 80, 24).fill(colors.textMain);
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
            headers.forEach((h, i) => doc.text(h, cols[i], y + 8, { width: cols[i + 1] - cols[i] - 4 }));
            y += 24;
          }

          const rowHeight = 35;
          doc.fillColor(idx % 2 === 0 ? colors.bg : '#ffffff').rect(40, y, doc.page.width - 80, rowHeight).fill();
          
          const name = ts.userId?.name || 'Unknown';
          const empId = ts.userId?.employeeId || '';
          const dept = ts.userId?.department || '—';
          const week = ts.weekStartDate ? new Date(ts.weekStartDate).toLocaleDateString('en-IN') : '—';
          const hours = `${ts.totalHours ?? 0}h`;
          const status = ts.status || '—';
          const statusColor = status === 'approved' ? '#059669' : status === 'rejected' ? '#dc2626' : '#d97706';

          doc.fillColor(colors.textMain).font('Helvetica-Bold').text(name, cols[0], y + 12, { width: cols[1] - cols[0] - 4 });
          doc.fillColor(colors.textMuted).font('Helvetica').fontSize(7).text(`#${empId}`, cols[0], y + 22);
          
          doc.fillColor(colors.textMain).fontSize(9).text(dept, cols[1], y + 12, { width: cols[2] - cols[1] - 4 });
          doc.text(week, cols[2], y + 12, { width: cols[3] - cols[2] - 4 });
          doc.fillColor(colors.primary).font('Helvetica-Bold').text(hours, cols[3], y + 12, { width: cols[4] - cols[3] - 4 });
          
          // Status tag
          doc.fillColor(statusColor).text(status.toUpperCase(), cols[4], y + 12, { width: 70 });
          
          doc.moveTo(40, y + rowHeight).lineTo(doc.page.width - 40, y + rowHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
          y += rowHeight;
        });
      }

      // ── Footer ──
      doc.fontSize(8).fillColor(colors.textMuted).font('Helvetica');
      doc.text(`${companyName} — Automated Enterprise Intelligence Report`, 40, doc.page.height - 40, { align: 'center', width: doc.page.width - 80 });

      doc.end();
    });
  },

  /**
   * Build a CSV/Excel buffer from report data.
   */
  async buildReportCsv(reportType, companyName, projectIds = [], format = 'CSV') {
    const data = await buildReportData(reportType, companyName, projectIds);
    const { timesheets, reportTitle } = data;

    const csvData = timesheets.map(ts => ({
        Employee: ts.userId?.name || 'Unknown',
        EmployeeID: ts.userId?.employeeId || '',
        Department: ts.userId?.department || '',
        WeekStatus: ts.weekStartDate ? new Date(ts.weekStartDate).toLocaleDateString('en-IN') : '',
        Hours: ts.totalHours ?? 0,
        Status: ts.status ? ts.status.toUpperCase() : ''
    }));

    const fields = ['Employee', 'EmployeeID', 'Department', 'WeekStatus', 'Hours', 'Status'];
    let csvString = '';
    
    if (csvData.length > 0) {
        const json2csvParser = new Parser({ fields });
        csvString = json2csvParser.parse(csvData);
    } else {
        csvString = fields.join(',') + '\n'; // empty headers
    }

    // if format is Excel, it is often useful to prepend BOM so excel opens UTF-8 properly
    const buffer = Buffer.from('\uFEFF' + csvString, 'utf8');
    const ext = format === 'Excel' ? 'csv' : 'csv'; // Using csv for both, Excel opens it
    const mime = format === 'Excel' ? 'application/vnd.ms-excel' : 'text/csv';

    return { buffer, reportTitle, recordCount: timesheets.length, ext, mime };
  },

  /**
   * Build PDF and send it as an email attachment.
   */
  async sendReportPdfEmail(recipientEmails, reportType, companyName, projectIds = []) {
    const transporter = getTransporter();
    const { buffer, reportTitle, recordCount } = await emailService.buildReportPdf(reportType, companyName, projectIds);
    const dateStr = new Date().toLocaleDateString('en-IN');
    const fileName = `${reportTitle.replace(/[^a-z0-9]/gi, '_')}_${dateStr.replace(/\//g, '-')}.pdf`;

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmails.join(','),
      subject: `[${companyName}] ${reportTitle} PDF — ${dateStr}`,
      html: `<p>Please find the attached ${reportTitle} PDF report.</p><p style="color:#64748b;font-size:13px">Records: <strong>${recordCount}</strong> | Generated: ${dateStr}</p>`,
      attachments: [{ filename: fileName, content: buffer, contentType: 'application/pdf' }],
    });

    return { sent: recipientEmails.length, reportTitle, recordCount, fileName };
  },

  /**
   * Generic notification email
   */
  async sendNotificationEmail(recipientEmail, { title, message, actionLink, actionLabel, companyName = 'CALTIMS' }) {
    const transporter = getTransporter();
    const html = buildNotificationHTML({ title, message, companyName, actionLink, actionLabel });

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `[${companyName}] ${title}`,
      html,
    });

    return true;
  },

  /**
   * Send welcome email to new employee
   */
  async sendWelcomeEmail(recipientEmail, { name, password, portalLink, companyName = 'CALTIMS' }) {
    const transporter = getTransporter();
    const html = buildWelcomeEmailHTML({ 
      name, 
      email: recipientEmail, 
      password, 
      portalLink, 
      companyName 
    });

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `Welcome to ${companyName} - Your Account Credentials`,
      html,
    });

    return true;
  },

  /**
   * Send payslip email to employee
   */
  async sendPayslipEmail(recipientEmail, payroll, organizationId, companyName = 'CALTIMS') {
    const transporter = getTransporter();
    const payslipService = require('../../modules/payroll/payslip.service');
    
    try {
        const buffer = await payslipService.generatePayslipBuffer(payroll, organizationId);
        const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'long' });
        const fileName = `Payslip_${payroll.employeeInfo?.employeeId || 'NA'}_${monthName}_${payroll.year}.pdf`;

        const html = _getPayslipEmailHtml(payroll, monthName, companyName);

        const info = await transporter.sendMail({
          from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: recipientEmail,
          subject: `[${companyName}] Payslip for ${monthName} ${payroll.year}`,
          html,
          attachments: [{ filename: fileName, content: buffer, contentType: 'application/pdf' }]
        });

        logger.info(`[EmailService] Payslip delivered to ${recipientEmail}: ID ${info.messageId}`);
        return true;
    } catch (err) {
        logger.error(`[EmailService] Failed to send payslip to ${recipientEmail}: ${err.message}`, { stack: err.stack });
        throw err; // bubble up for controller
    }
  },

  /**
   * Bulk Dispatch with Browser Reuse - Strategy 4 (Performance Fix)
   * This reuses a single browser instance for all PDFs to avoid crashing the server.
   */
  async sendPayslipsBulk(payrolls, companyName = 'CALTIMS') {
    const transporter = getTransporter();
    const pdfGeneratorService = require('../../modules/reports/pdfGenerator.service');
    const { getProfessionalPayslipEmailBody } = require('../../modules/payroll/payslip.template');
    
    logger.info(`[EmailService] Initiating bulk dispatch for ${payrolls.length} employees`);
    
    const results = { sent: 0, failed: 0, errors: [] };

    for (const item of payrolls) {
        const { email, data } = item;
        try {
            const monthName = new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' });
            
            // Generate PDF buffer using PDFKit-based generator
            const buffer = await pdfGeneratorService.generatePayslipBuffer(data);

            const fileName = `Payslip_${data.user?.employeeId || data.employeeInfo?.employeeId || 'NA'}_${monthName}_${data.year}.pdf`;
            
            // Get premium professional email body
            const html = getProfessionalPayslipEmailBody(data, { organization: { companyName } });

            await transporter.sendMail({
                from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to: email,
                subject: `[${companyName}] Payslip for ${monthName} ${data.year}`,
                html,
                attachments: [{ filename: fileName, content: buffer, contentType: 'application/pdf' }]
            });

            results.sent++;
            logger.debug(`[EmailService] Bulk dispatched: ${email}`);
        } catch (err) {
            results.failed++;
            results.errors.push({ email, error: err.message });
            logger.error(`[EmailService] Failed bulk dispatch for ${email}: ${err.message}`);
        }
    }

    return results;
  },

  /**
   * Send trial reminder email
   */
  async sendTrialReminder(recipientEmail, userName, daysLeft, companyName = 'CALTIMS') {
    const transporter = getTransporter();
    const isExpired = daysLeft === 0;
    
    const title = isExpired ? 'Your Trial Has Expired' : `Trial Reminder: ${daysLeft} Days Left`;
    const message = isExpired 
      ? `Hello ${userName}, your 28-day free trial of ${companyName} has expired. Please upgrade your plan to continue using our services.`
      : `Hello ${userName}, your free trial of ${companyName} will expire in ${daysLeft} days. Upgrade now to ensure uninterrupted access to your data.`;
    
    const html = buildNotificationHTML({ 
      title, 
      message, 
      companyName, 
      actionLink: `${process.env.CLIENT_URL}/settings?tab=subscription`,
      actionLabel: isExpired ? 'Upgrade Now' : 'View Plans'
    });

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `[${companyName}] ${title}`,
      html,
    });

    return true;
  }
};

/** Internal HTML Helper (Not used if using template) */
function _getPayslipEmailHtml(payroll, monthName, companyName) {
  const { getProfessionalPayslipEmailBody } = require('../../modules/payroll/payslip.template');
  // Return the professional email body
  return getProfessionalPayslipEmailBody(payroll, { organization: { companyName } });
}

module.exports = emailService;
