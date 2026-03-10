'use strict';

const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const Timesheet = require('../../modules/timesheets/timesheet.model');
const { TIMESHEET_STATUS } = require('../../constants');

// ── Transporter ─────────────────────────────────────────────────────────────
function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('SMTP credentials not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to .env');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Report Data Fetcher ──────────────────────────────────────────────────────
async function buildReportData(reportType, companyName = 'TimesheetPro', projectIds = []) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 90); // last 90 days (full quarter)

  let statusFilter;
  let reportTitle;

  switch (reportType) {
    case 'approved':
      statusFilter = TIMESHEET_STATUS.APPROVED;
      reportTitle = 'Approved Timesheets';
      break;
    case 'rejected':
      statusFilter = TIMESHEET_STATUS.REJECTED;
      reportTitle = 'Rejected Timesheets';
      break;
    case 'pending':
      statusFilter = TIMESHEET_STATUS.SUBMITTED;
      reportTitle = 'Pending (Submitted) Timesheets';
      break;
    case 'all':
    default:
      statusFilter = null; // no status filter
      reportTitle = 'All Timesheets (Full Report)';
      break;
  }

  // Always exclude draft timesheets from all reports
  const query = { weekStartDate: { $gte: from, $lte: now }, status: { $ne: TIMESHEET_STATUS.DRAFT } };
  if (statusFilter) query.status = statusFilter;

  let timesheets = await Timesheet.find(query)
    .populate('userId', 'name email employeeId department')
    .populate('rows.projectId', 'name code')
    .sort({ weekStartDate: -1 })
    .limit(100)
    .lean();

  // Filter by project if specific projects selected
  if (projectIds && projectIds.length > 0) {
    const mongoose = require('mongoose');
    const projIdStrings = projectIds.map(id => id.toString());
    timesheets = timesheets.filter(ts =>
      ts.rows?.some(row => row.projectId && projIdStrings.includes(row.projectId._id?.toString() || row.projectId.toString()))
    );
  }

  return { timesheets, reportTitle, companyName, generatedAt: now.toISOString(), projectIds };
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
   */
  async sendReportEmail(recipientEmails, reportType, companyName, projectIds = []) {
    const transporter = createTransporter(); // throws if not configured
    const data = await buildReportData(reportType, companyName, projectIds);
    const html = buildEmailHTML(data);

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmails.join(','),
      subject: `[${companyName}] ${data.reportTitle} — ${new Date().toLocaleDateString('en-IN')}`,
      html,
    });

    return { sent: recipientEmails.length, reportTitle: data.reportTitle };
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(userEmail, userName, resetToken, companyName = 'CALTIMS') {
    const transporter = createTransporter();
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
    const transporter = createTransporter();
    
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

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), reportTitle, recordCount: timesheets.length }));
      doc.on('error', reject);

      // ── Header band ──
      doc.rect(0, 0, doc.page.width, 80).fill('#6366f1');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(companyName, 40, 22);
      doc.fontSize(11).font('Helvetica').text(reportTitle, 40, 50);

      // ── Meta row ──
      doc.fillColor('#475569').fontSize(10).font('Helvetica');
      doc.text(`Generated: ${date} (IST)   |   Records: ${timesheets.length}`, 40, 95);

      // ── Table headers ──
      const cols = [40, 170, 290, 370, 435, 510];
      const headers = ['Employee', 'Dept', 'Week', 'Hours', 'Status'];
      let y = 120;

      doc.rect(40, y, doc.page.width - 80, 20).fill('#f1f5f9');
      doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, cols[i], y + 5, { width: cols[i + 1] - cols[i] - 4 }));
      y += 24;

      // ── Rows ──
      doc.font('Helvetica').fontSize(9);
      if (timesheets.length === 0) {
        doc.fillColor('#94a3b8').text('No records found for the selected period.', 40, y + 20, { align: 'center', width: doc.page.width - 80 });
      } else {
        timesheets.forEach((ts, idx) => {
          if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
          const rowHeight = 18;
          if (idx % 2 === 0) doc.rect(40, y, doc.page.width - 80, rowHeight).fill('#f8fafc');
          const name = ts.userId?.name || 'Unknown';
          const empId = ts.userId?.employeeId || '';
          const dept = ts.userId?.department || '—';
          const week = ts.weekStartDate ? new Date(ts.weekStartDate).toLocaleDateString('en-IN') : '—';
          const hours = `${ts.totalHours ?? 0}h`;
          const status = ts.status || '—';
          const statusColor = status === 'approved' ? '#16a34a' : status === 'rejected' ? '#dc2626' : '#d97706';
          doc.fillColor('#1e293b').text(`${name}${empId ? ` #${empId}` : ''}`, cols[0], y + 4, { width: cols[1] - cols[0] - 4 });
          doc.fillColor('#475569').text(dept, cols[1], y + 4, { width: cols[2] - cols[1] - 4 });
          doc.text(week, cols[2], y + 4, { width: cols[3] - cols[2] - 4 });
          doc.fillColor('#6366f1').font('Helvetica-Bold').text(hours, cols[3], y + 4, { width: cols[4] - cols[3] - 4 });
          doc.fillColor(statusColor).text(status.toUpperCase(), cols[4], y + 4, { width: 70 });
          doc.font('Helvetica').fillColor('#475569');
          doc.moveTo(40, y + rowHeight).lineTo(doc.page.width - 40, y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          y += rowHeight;
        });
      }

      // ── Footer ──
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
      doc.text(`${companyName} — Automated Timesheet Report`, 40, doc.page.height - 40, { align: 'center', width: doc.page.width - 80 });

      doc.end();
    });
  },

  /**
   * Build PDF and send it as an email attachment.
   */
  async sendReportPdfEmail(recipientEmails, reportType, companyName, projectIds = []) {
    const transporter = createTransporter();
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
    const transporter = createTransporter();
    const html = buildNotificationHTML({ title, message, companyName, actionLink, actionLabel });

    await transporter.sendMail({
      from: `"${companyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `[${companyName}] ${title}`,
      html,
    });

    return true;
  },
};

module.exports = emailService;
