'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFound } = require('./middleware/error.middleware');
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
const schedulerService = require('./shared/services/scheduler.service');

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 500, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'development',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 20,
  message: { success: false, message: 'Too many auth requests, please try again later.' },
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);

// ─── Body Parsing & Sanitization ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize()); // NoSQL injection prevention
app.use(compression());

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.http(message.trim()) },
    })
  );
}

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
app.use('/api/v1/auth', authRoutes);
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

// ─── Start Scheduler ────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  schedulerService.start();
}

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
