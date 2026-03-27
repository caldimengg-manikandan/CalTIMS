'use strict';

const axios = require('axios');
const Device = require('./device.model');
const attendanceService = require('./attendance.service');
const hikvisionParser = require('./hikvision.parser');
const logger = require('../../shared/utils/logger');

const hikvisionService = {
  /**
   * Test connection to a Hikvision device.
   */
  async testConnection(deviceConfig) {
    const { ipAddress, port, username, password } = deviceConfig;
    const url = `http://${ipAddress}:${port}/ISAPI/System/deviceInfo`;

    try {
      const response = await axios.get(url, {
        auth: { username, password },
        timeout: 5000
      });

      return {
        success: response.status === 200,
        data: response.data,
        message: 'Connection successful'
      };
    } catch (err) {
      logger.error(`[HikvisionService] Connection test failed for ${ipAddress}:`, err.message);
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        error: err.response?.data || err.message
      };
    }
  },

  /**
   * Fetch events from Hikvision device with pagination.
   */
  async fetchEvents(device, startTime, endTime, position = 0) {
    const { ipAddress, port, username, password } = device.config;
    const url = `http://${ipAddress}:${port}/ISAPI/AccessControl/AcsEvent?format=json`;

    const payload = {
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: position,
        maxResults: 30,
        startTime: startTime.toISOString().split('.')[0] + 'Z',
        endTime: endTime.toISOString().split('.')[0] + 'Z'
      }
    };

    try {
      const response = await axios.post(url, payload, {
        auth: { username, password },
        timeout: 10000
      });

      return response.data;
    } catch (err) {
      logger.error(`[HikvisionService] Fetch events failed for ${ipAddress}:`, err.message);
      throw err;
    }
  },

   /**
   * Synchronize a single device.
   */
  async syncDevice(deviceId, options = {}) {
    const { startTime: manualStartTime = null, endTime: manualEndTime = null } = options;
    const device = await Device.findById(deviceId);
    if (!device || !device.enabled) return;

    const now = new Date();
    // Start from lastSyncAt or 24 hours ago if never synced
    const startTime = manualStartTime || device.lastSyncAt || new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const endTime = manualEndTime || now;

    let position = 0;
    let totalProcessed = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const data = await this.fetchEvents(device, startTime, endTime, position);
        const events = data.AcsEvent?.InfoList || [];
        const totalMatches = data.AcsEvent?.totalMatches || 0;

        if (events.length === 0) {
          hasMore = false;
          break;
        }

        const logsToSync = events
          .map(e => hikvisionParser.parseEvent(e))
          .filter(Boolean);

        if (logsToSync.length > 0) {
          await attendanceService.syncLogs(logsToSync);
          totalProcessed += logsToSync.length;
        }

        position += events.length;
        hasMore = position < totalMatches;
        
        // Safety break to prevent infinite loops if API behaves unexpectedly
        if (position >= totalMatches || events.length === 0) break;
      }

      // Only update lastSyncAt if it's a regular sync (not a manual range)
      if (!manualStartTime && !manualEndTime) {
        device.lastSyncAt = endTime;
      }
      device.status = 'online';
      device.lastError = '';
      await device.save();

      logger.info(`[HikvisionService] Device ${device.name} synced. Processed ${totalProcessed} events.`);
      return { success: true, processed: totalProcessed };

    } catch (err) {
      device.status = 'error';
      device.lastError = err.message;
      await device.save();
      logger.error(`[HikvisionService] Sync failed for ${device.name}:`, err.message);
      throw err;
    }
  },

  /**
   * Sync all enabled Hikvision devices.
   */
  async syncAllDevices(options = {}) {
    const devices = await Device.find({ type: 'hikvision', enabled: true });
    const results = [];

    for (const device of devices) {
      try {
        const result = await this.syncDevice(device._id, options);
        results.push({ deviceId: device._id, ...result });
      } catch (err) {
        results.push({ deviceId: device._id, success: false, error: err.message });
      }
    }

    return results;
  }
};

module.exports = hikvisionService;
