const https = require('https');
const axios = require('axios');
const Device = require('./device.model');
const attendanceService = require('./attendance.service');
const hikcentralParser = require('./hikcentral.parser');
const artemisHelper = require('../../shared/utils/artemis.helper');
const logger = require('../../shared/utils/logger');

const hikcentralService = {
  /**
   * Test connection to HikCentral Artemis API.
   */
  async testConnection(config) {
    const host = process.env.HIKCENTRAL_HOST || config.host;
    const appKey = process.env.HIKCENTRAL_APP_KEY || config.appKey;
    const appSecret = process.env.HIKCENTRAL_APP_SECRET || config.appSecret;

    const url = '/artemis/api/attendance/v1/report';
    const method = 'POST';
    const fullUrl = `${host}${url}`;

    const headers = artemisHelper.getHeaders(appKey, appSecret, method, url);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const formatDate = (date) => {
      const pad = (num) => (num < 10 ? '0' + num : num);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} 05:30`;
    };

    try {
      const response = await axios.post(fullUrl, {
        attendanceReportRequest: {
          pageNo: 1,
          pageSize: 1,
          queryInfo: {
            beginTime: formatDate(yesterday),
            endTime: formatDate(now),
            sortInfo: { sortField: 1, sortType: 1 }
          }
        }
      }, { 
        headers, 
        timeout: 5000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });

      return {
        success: true,
        data: response.data,
        message: 'Connection to HikCentral successful'
      };
    } catch (err) {
      logger.error(`[HikCentralService] Connection test failed:`, err.message);
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        error: err.response?.data || err.message
      };
    }
  },

   /**
   * Synchronize events from HikCentral using Attendance Report API.
   */
  async syncDevice(device, options = {}) {
    const { targetPersonCode = null, startTime: manualStartTime = null, endTime: manualEndTime = null } = options;
    if (!device || device.type !== 'hikcentral' || !device.enabled) return;
    if (targetPersonCode) {
      logger.info(`[HikCentralService] Targeted sync for ${targetPersonCode} on ${device.name}`);
    }

    const host = process.env.HIKCENTRAL_HOST || device.config?.host;
    const appKey = process.env.HIKCENTRAL_APP_KEY || device.config?.appKey;
    const appSecret = process.env.HIKCENTRAL_APP_SECRET || device.config?.appSecret;

    if (!host || !appKey || !appSecret) {
      logger.error('[HikCentralService] Missing environment configuration');
      return;
    }

    const now = new Date();
    const startTime = manualStartTime || device.lastSyncAt || new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const endTime = manualEndTime || now;

    const url = '/artemis/api/attendance/v1/report';
    const method = 'POST';
    const fullUrl = `${host}${url}`;

    const formatDate = (date) => {
      const pad = (num) => (num < 10 ? '0' + num : num);
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const h = pad(date.getHours());
      const min = pad(date.getMinutes());
      const s = pad(date.getSeconds());
      return `${y}-${m}-${d}T${h}:${min}:${s} 05:30`;
    };

    let pageNo = 1;
    const pageSize = 100;
    let hasMore = true;
    let totalProcessed = 0;

    try {
      while (hasMore) {
        const headers = artemisHelper.getHeaders(appKey, appSecret, method, url);
        const payload = {
          attendanceReportRequest: {
            pageNo,
            pageSize,
            queryInfo: {
              beginTime: formatDate(startTime),
              endTime: formatDate(endTime),
              sortInfo: { sortField: 1, sortType: 1 }
            }
          }
        };

        const response = await axios.post(fullUrl, payload, { 
          headers, 
          timeout: 20000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        
        const data = response.data;

        if (data.code !== '0' && data.code !== 0) {
          throw new Error(`HikCentral API error: ${data.msg || data.message || 'Unknown error'}`);
        }

        const records = data.data?.record || data.record || [];
        
        const logsToSync = [];
        for (const record of records) {
          const personInfo = record.personInfo || {};
          const personCode = personInfo.personCode || personInfo.personID;
          
          if (targetPersonCode && personCode !== targetPersonCode) {
            continue;
          }

          const checkIn = hikcentralParser.parseEvent(record);
          if (checkIn) logsToSync.push(checkIn);

          const checkOut = hikcentralParser.parseCheckout(record);
          if (checkOut) logsToSync.push(checkOut);
        }

        if (logsToSync.length > 0) {
          await attendanceService.syncLogs(logsToSync, device.organizationId);
          totalProcessed += logsToSync.length;
        }

        pageNo++;
        // Stop if we reached the end or returned fewer than pageSize
        hasMore = records.length === pageSize;
      }

      // Only update lastSyncAt if it's a regular sync (not a manual range)
      if (!manualStartTime && !manualEndTime) {
        device.lastSyncAt = endTime;
      }
      device.status = 'online';
      device.lastError = '';
      await device.save();

      logger.info(`[HikCentralService] Synced ${totalProcessed} logs from ${device.name}.`);
      return { success: true, processed: totalProcessed };

    } catch (err) {
      device.status = 'error';
      device.lastError = err.message;
      await device.save();
      logger.error(`[HikCentralService] Sync failed for ${device.name}:`, err.message);
      throw err;
    }
  },

  /**
   * Sync all HikCentral devices (usually one per HikCentral server).
   */
  async syncAll(options = {}) {
    const devices = await Device.find({ type: 'hikcentral', enabled: true });
    const results = [];

    for (const device of devices) {
      try {
        const result = await this.syncDevice(device, options);
        results.push({ deviceId: device._id, ...result });
      } catch (err) {
        results.push({ deviceId: device._id, success: false, error: err.message });
      }
    }

    return results;
  }
};

module.exports = hikcentralService;
