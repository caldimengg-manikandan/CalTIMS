'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
// ─── Body Parsing & Sanitization ─────────────────────────────────────────────
const { errorHandler, notFound } = require('./middleware/error.middleware');
const accountLock = require('./middleware/lock.middleware');
const logger = require('./shared/utils/logger');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const timesheetRoutes = require('./modules/timesheets/timesheet.routes');
const projectRoutes = require('./modules/projects/project.routes');
const leaveRoutes = require('./modules/leaves/leave.routes');
const announcementRoutes = require('./modules/announcements/announcement.routes');
const calendarRoutes = require('./modules/calendar/calendar.routes');
const reportRoutes = require('./modules/reports/report.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const reportScheduleRoutes = require('./modules/reportSchedules/reportSchedule.routes');
const taskRoutes = require('./modules/tasks/task.routes');
const incidentRoutes = require('./modules/incidents/incident.routes');
const systemRoutes = require('./modules/system/system.routes');
const supportRoutes = require('./modules/support/support.routes');
const { router: auditRoutes } = require('./modules/audit/audit.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const schedulerService = require('./shared/services/scheduler.service');

const app = express();
app.set('etag', false);

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ].filter(Boolean);
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing & Sanitization ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize()); // NoSQL injection prevention
app.use(compression());

const path = require('path');

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.http(message.trim()) },
    })
  );
}

// ─── Static Files ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Timesheet API is live',
  });
});

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Timesheet API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);

// Apply account lock to all other routes
app.use(accountLock);

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/timesheets', timesheetRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/report-schedules', reportScheduleRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/attendance', attendanceRoutes);

// ─── Start Scheduler ────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  schedulerService.start();
  const complianceService = require('./shared/services/compliance.service');
  complianceService.startCronJobs();
  
  // Hikvision Integration Cron
  const hikvisionCron = require('./modules/attendance/hikvision.cron');
  hikvisionCron.start();

  // HikCentral Integration Cron
  const hikcentralCron = require('./modules/attendance/hikcentral.cron');
  hikcentralCron.start();
}

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
