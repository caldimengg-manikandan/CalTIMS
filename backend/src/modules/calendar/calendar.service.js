const { prisma } = require('../../config/database');
const { google } = require('googleapis');
const axios = require('axios');
const logger = require('../../shared/utils/logger');
const { encrypt, decrypt } = require('../../shared/utils/security');

class CalendarService {
  /**
   * Sync events for a specific integration
   */
  async syncEvents(integrationId) {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
      include: { user: true }
    });

    if (!integration) throw new Error('Integration not found');

    try {
      let events = [];
      if (integration.provider === 'google') {
        events = await this.fetchGoogleEvents(integration);
      } else if (integration.provider === 'microsoft') {
        events = await this.fetchOutlookEvents(integration);
      }

      // Save events to database
      await this.saveEvents(integration, events);

      // Update last synced time
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: { 
          lastSyncedAt: new Date(),
          status: 'CONNECTED'
        }
      });

      return events;
    } catch (error) {
      logger.error(`Sync error for ${integration.provider}: ${error.message}`);
      
      // If unauthorized, mark as expired
      if (error.response?.status === 401 || error.code === 401) {
        await prisma.calendarIntegration.update({
          where: { id: integration.id },
          data: { status: 'EXPIRED' }
        });
      }
      throw error;
    }
  }

  /**
   * Fetch Google Calendar Events
   */
  async fetchGoogleEvents(integration) {
    // We should use the same redirect URI used during the exchange for consistancy, 
    // although for refreshes it's often not strictly required if using offline access.
    // Given we moved to a backend proxy, we use that pattern.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      // Fallback logic for background sync where req is not available
      process.env.GOOGLE_CALENDAR_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL
    );

    const accessToken = decrypt(integration.accessToken);
    const refreshToken = decrypt(integration.refreshToken);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // Check if token expired and refresh if needed
    if (integration.tokenExpiry && new Date() > new Date(integration.tokenExpiry)) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(credentials.access_token),
          tokenExpiry: new Date(credentials.expiry_date)
        }
      });
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Past 30 days
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.data.items.map(item => ({
      externalId: item.id,
      title: item.summary || 'No Title',
      description: item.description,
      startDate: new Date(item.start.dateTime || item.start.date),
      endDate: new Date(item.end.dateTime || item.end.date),
      location: item.location,
      provider: 'google',
      color: '#4285F4'
    }));
  }

  /**
   * Fetch Outlook Events
   */
  async fetchOutlookEvents(integration) {
    let accessToken = decrypt(integration.accessToken);

    // Refresh token if expired
    if (integration.tokenExpiry && new Date() > new Date(integration.tokenExpiry)) {
      accessToken = await this.refreshOutlookToken(integration);
    }

    const response = await axios.get('https://graph.microsoft.com/v1.0/me/events', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        $select: 'id,subject,bodyPreview,start,end,location',
        $top: 100
      }
    });

    return response.data.value.map(item => ({
      externalId: item.id,
      title: item.subject || 'No Title',
      description: item.bodyPreview,
      startDate: new Date(item.start.dateTime),
      endDate: new Date(item.end.dateTime),
      location: item.location?.displayName,
      provider: 'microsoft',
      color: '#0078D4'
    }));
  }

  async refreshOutlookToken(integration) {
    const refreshToken = decrypt(integration.refreshToken);
    const params = new URLSearchParams();
    params.append('client_id', process.env.MICROSOFT_CLIENT_ID);
    params.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params);
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    await prisma.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : undefined,
        tokenExpiry: new Date(Date.now() + expires_in * 1000)
      }
    });

    return access_token;
  }

  /**
   * Save events to DB, avoiding duplicates
   */
  async saveEvents(integration, events) {
    const { userId, organizationId } = integration;

    for (const event of events) {
      await prisma.calendarEvent.upsert({
        where: { 
            // We need a unique constraint or manual check
            // Since we don't have a unique constraint on externalId in schema yet (oops)
            // I'll add a manual check or update the schema if I can.
            // For now, let's assume we use externalId + userId + provider as a check.
            id: 'placeholder' 
        },
        create: { ...event, userId, organizationId },
        update: { ...event }
      }).catch(async (e) => {
          // Manual upsert if unique constraint is missing
          const existing = await prisma.calendarEvent.findFirst({
              where: { userId, externalId: event.externalId, provider: event.provider }
          });
          if (existing) {
              await prisma.calendarEvent.update({ where: { id: existing.id }, data: event });
          } else {
              await prisma.calendarEvent.create({ data: { ...event, userId, organizationId } });
          }
      });
    }
    
    // Cleanup old events (optional)
  }

  /**
   * Get merged calendar view
   */
  async getMergedEvents(userId, organizationId, start, end, isAdmin = false) {
    const leaveWhere = { 
      organizationId, 
      status: 'APPROVED', 
      startDate: { lte: end }, 
      endDate: { gte: start } 
    };

    // If not admin/HR, only show their own leaves
    if (!isAdmin) {
      const employee = await prisma.employee.findUnique({
        where: { userId }
      });
      if (employee) {
        leaveWhere.employeeId = employee.id;
      } else {
        // Not an employee, don't show leaves
        leaveWhere.id = 'none';
      }
    }

    const [internalEvents, holidays, externalEvents, leaves] = await Promise.all([
      prisma.companyEvent.findMany({ 
        where: { organizationId, startDate: { lte: end }, endDate: { gte: start } }
      }),
      prisma.holiday.findMany({
        where: { organizationId, date: { gte: start, lte: end } }
      }),
      prisma.calendarEvent.findMany({
        where: { userId, startDate: { lte: end }, endDate: { gte: start } }
      }),
      prisma.leave.findMany({
        where: leaveWhere,
        include: { 
          employee: { include: { user: { select: { name: true } } } },
          type: { select: { name: true } }
        }
      })
    ]);

    return [
      ...internalEvents.map(e => ({ ...e, eventType: 'company_event', source: 'internal' })),
      ...holidays.map(h => ({ ...h, id: h.id, title: h.name, startDate: h.date, endDate: h.date, eventType: 'holiday', source: 'internal', color: '#ef4444' })),
      ...externalEvents.map(e => ({ ...e, eventType: 'personal_event', source: e.provider })),
      ...leaves.map(l => ({ 
        ...l, 
        title: `${l.employee?.user?.name || 'Employee'}: ${l.type?.name || 'Leave'}`, 
        eventType: 'leave', 
        source: 'internal', 
        color: '#10b981' 
      }))
    ];
  }
}

module.exports = new CalendarService();
