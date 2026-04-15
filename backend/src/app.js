'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased to 5000 requests per 15 mins
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Increased to 100 requests per hour for login
  message: 'Too many login attempts, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

const financeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Increased to 1000 requests per hour for sensitive data
  message: 'Too many payroll/report requests, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Body Parsing ─────────────────────────────────────────────────────────────
const { errorHandler, notFound } = require('./middleware/error.middleware');
const logger = require('./shared/utils/logger');
const passport = require('./config/passport');


// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const roleRoutes = require('./modules/users/role.routes');

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
const supportRoutes = require('./modules/support/support.routes');
const { router: auditRoutes } = require('./modules/audit/audit.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const schedulerService = require('./shared/services/scheduler.service');

const app = express();
app.set('trust proxy', 1);
app.set('etag', false);

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://192.168.1.15:3000'
      ].filter(Boolean);
      
      // Allow system origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Allow local network IPs in development/private environments
      const isLocalIP = origin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/);
      if (isLocalIP) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(compression());
app.use(passport.initialize());

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

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Timesheet API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const { authenticate } = require('./middleware/auth.middleware');
const { checkSubscription } = require('./middleware/subscription.middleware');

// Apply general limiter for all API requests
app.use('/api/v1', generalLimiter);

// Protect sensitive endpoints with stricter limits
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/payroll', financeLimiter);
app.use('/api/v1/reports', financeLimiter);
app.use('/api/v1/support', supportRoutes);

// Apply protection to all subsequent routes
app.use('/api/v1', authenticate, checkSubscription);

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);

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
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/payroll', require('./modules/payroll/payroll.routes'));
app.use('/api/v1/payslip-templates', require('./modules/payroll/payslipTemplate.routes'));
app.use('/api/v1/policy', require('./modules/policyEngine/policy.routes'));
app.use('/api/v1/subscriptions', require('./modules/subscriptions/subscription.routes'));
app.use('/api/v1/admin', adminRoutes);

// ─── SPA Fallback ───────────────────────────────────────────────────────────
// This must be after API routes and static files, but before error handlers
app.get('*', (req, res, next) => {
  // If it's an API request that wasn't handled, pass to 404 handler
  if (req.originalUrl.startsWith('/api/')) {
    return next();
  }
  // Otherwise, serve index.html for React Router to handle
  res.sendFile(path.join(frontendPath, 'index.html'));
});

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

  // Payroll Scheduler
  const payrollScheduler = require('./modules/payroll/payroll.scheduler');
  payrollScheduler.start();
}

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
