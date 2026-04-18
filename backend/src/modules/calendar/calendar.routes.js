const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');
const calendarService = require('./calendar.service');
const { google } = require('googleapis');
const axios = require('axios');
const { encrypt } = require('../../shared/utils/security');

// Public callback routes (MUST be before authenticate middleware)
router.get('/callback/google/proxy', (req, res) => {
  const { code, state } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  // Redirect back to frontend with the same params
  res.redirect(`${clientUrl}/settings?tab=integrations&provider=google&code=${code}&state=${state}`);
});

router.get('/callback/outlook/proxy', (req, res) => {
  const { code, state } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  // Redirect back to frontend with the same params
  res.redirect(`${clientUrl}/settings?tab=integrations&provider=outlook&code=${code}&state=${state}`);
});

router.use(authenticate);

// ── GET calendar events (Merged) ─────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const userId = req.user.id;
  const organizationId = req.organizationId;

  const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = to ? new Date(to) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const isAdmin = req.user.isSuperAdmin || req.user.isOwner || (req.user.permissions?.['Settings']?.['General']?.['edit'] === true);
  const events = await calendarService.getMergedEvents(userId, organizationId, start, end, isAdmin);
  ApiResponse.success(res, { data: events });
}));

// ── GET integration status ───────────────────────────────────────────────────
router.get('/integrations', asyncHandler(async (req, res) => {
  const integrations = await prisma.calendarIntegration.findMany({
    where: { userId: req.user.id }
  });
  ApiResponse.success(res, { data: integrations });
}));

// ── OAuth Initiation Endpoints ──────────────────────────────────────────────
router.get('/connect/google', (req, res) => {
  // Construct the absolute backend URL for the proxy callback
  const protocol = req.protocol === 'http' && process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const host = req.get('host');
  // We use the same base path as matched in app.js
  const redirectUri = `${protocol}://${host}/api/v1/calendar/callback/google/proxy`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: req.user.id
  });

  res.redirect(url);
});

router.get('/connect/outlook', (req, res) => {
  const protocol = req.protocol === 'http' && process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/v1/calendar/callback/outlook/proxy`;

  const baseUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access User.Read Calendars.Read',
    state: req.user.id
  });

  res.redirect(`${baseUrl}?${params.toString()}`);
});

// ── OAuth Callback Handlers (Protected - Frontend usually redirects here) ───
router.post('/callback/google', asyncHandler(async (req, res) => {
  const { code } = req.body;
  const protocol = req.protocol === 'http' && process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/v1/calendar/callback/google/proxy`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  
  const integration = await prisma.calendarIntegration.upsert({
    where: { 
      userId_provider: { userId: req.user.id, provider: 'google' } 
    },
    create: {
      userId: req.user.id,
      organizationId: req.organizationId,
      provider: 'google',
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      status: 'CONNECTED'
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      status: 'CONNECTED'
    }
  });

  // Trigger initial sync
  await calendarService.syncEvents(integration.id);

  ApiResponse.success(res, { message: 'Google Calendar connected successfully', data: integration });
}));

router.post('/callback/outlook', asyncHandler(async (req, res) => {
  const { code } = req.body;
  const protocol = req.protocol === 'http' && process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/v1/calendar/callback/outlook/proxy`;
  
  const params = new URLSearchParams();
  params.append('client_id', process.env.MICROSOFT_CLIENT_ID);
  params.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirectUri);

  const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params);
  const { access_token, refresh_token, expires_in } = response.data;

  const integration = await prisma.calendarIntegration.upsert({
    where: { 
      userId_provider: { userId: req.user.id, provider: 'microsoft' } 
    },
    create: {
      userId: req.user.id,
      organizationId: req.organizationId,
      provider: 'microsoft',
      accessToken: encrypt(access_token),
      refreshToken: refresh_token ? encrypt(refresh_token) : undefined,
      tokenExpiry: new Date(Date.now() + expires_in * 1000),
      status: 'CONNECTED'
    },
    update: {
      accessToken: encrypt(access_token),
      refreshToken: refresh_token ? encrypt(refresh_token) : undefined,
      tokenExpiry: new Date(Date.now() + expires_in * 1000),
      status: 'CONNECTED'
    }
  });

  // Trigger initial sync
  await calendarService.syncEvents(integration.id);

  ApiResponse.success(res, { message: 'Outlook Calendar connected successfully', data: integration });
}));

// ── Disconnect Integration ───────────────────────────────────────────────────
router.delete('/integrations/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  
  await prisma.$transaction([
    prisma.calendarIntegration.delete({
      where: { userId_provider: { userId: req.user.id, provider } }
    }),
    prisma.calendarEvent.deleteMany({
      where: { userId: req.user.id, provider }
    })
  ]);

  ApiResponse.success(res, { message: `${provider} Calendar disconnected` });
}));

// ── Manual Sync ──────────────────────────────────────────────────────────────
router.post('/sync', asyncHandler(async (req, res) => {
  const integrations = await prisma.calendarIntegration.findMany({
    where: { userId: req.user.id, status: 'CONNECTED' }
  });

  for (const integration of integrations) {
    await calendarService.syncEvents(integration.id).catch(err => {
        logger.error(`Manual sync failed for ${integration.provider}: ${err.message}`);
    });
  }

  ApiResponse.success(res, { message: 'Sync triggered successfully' });
}));

// ── Create Event ─────────────────────────────────────────────────────────────
router.post('/', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const { title, eventType, startDate, endDate, description, isGlobal } = req.body;
  const organizationId = req.organizationId;
  const userId = req.user.id;

  let event;
  if (eventType === 'holiday') {
    event = await prisma.holiday.create({
      data: {
        name: title,
        date: new Date(startDate),
        organizationId,
        isPublic: isGlobal ?? true
      }
    });
  } else if (eventType === 'company_event') {
    event = await prisma.companyEvent.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate || startDate),
        organizationId
      }
    });
  } else {
    // Default to personal event
    event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate || startDate),
        organizationId,
        userId,
        provider: 'internal'
      }
    });
  }

  ApiResponse.success(res, { message: 'Event created', data: event });
}));

// ── Update Event ─────────────────────────────────────────────────────────────
router.put('/:id', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, eventType, startDate, endDate, description, isGlobal } = req.body;
  const organizationId = req.organizationId;

  let event;
  
  // Strategy: If eventType is provided, try that table first. Otherwise fall back to sequence.
  const tryHoliday = async () => prisma.holiday.update({
    where: { id, organizationId },
    data: { name: title, date: new Date(startDate), isPublic: isGlobal ?? true }
  });

  const tryCompanyEvent = async () => prisma.companyEvent.update({
    where: { id, organizationId },
    data: { title, description, startDate: new Date(startDate), endDate: new Date(endDate || startDate) }
  });

  const tryPersonalEvent = async () => prisma.calendarEvent.update({
    where: { id, organizationId, userId: req.user.id },
    data: { title, description, startDate: new Date(startDate), endDate: new Date(endDate || startDate) }
  });

  try {
    if (eventType === 'holiday') {
      event = await tryHoliday();
    } else if (eventType === 'company_event') {
      event = await tryCompanyEvent();
    } else {
      event = await tryPersonalEvent();
    }
  } catch (err) {
    // If specific type failed (maybe it was changed?), try all in order
    try {
      event = await tryHoliday();
    } catch (e1) {
      try {
        event = await tryCompanyEvent();
      } catch (e2) {
        event = await tryPersonalEvent();
      }
    }
  }

  ApiResponse.success(res, { message: 'Event updated', data: event });
}));

// ── Delete Event ─────────────────────────────────────────────────────────────
router.delete('/:id', checkPermission('Settings', 'General', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.organizationId;

  // Try to delete from each table
  let deleted = false;
  try {
    await prisma.holiday.delete({ where: { id, organizationId } });
    deleted = true;
  } catch (e) {
    try {
      await prisma.companyEvent.delete({ where: { id, organizationId } });
      deleted = true;
    } catch (e2) {
      try {
        await prisma.calendarEvent.delete({ where: { id, organizationId, userId: req.user.id } });
        deleted = true;
      } catch (e3) {
        // Not found in any table
      }
    }
  }

  if (!deleted) {
    return ApiResponse.error(res, 'Event not found', 404);
  }

  ApiResponse.success(res, { message: 'Event deleted' });
}));

module.exports = router;
