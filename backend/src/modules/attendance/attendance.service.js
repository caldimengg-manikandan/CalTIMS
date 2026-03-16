'use strict';

const AttendanceLog = require('./attendance.model');
const User = require('../users/user.model');
const AppError = require('../../shared/utils/AppError');
const Settings = require('../settings/settings.model');

const attendanceService = {
  /**
   * Synchronize logs from a daemon or direct push.
   * Expects an array of logs: [{ employeeId, timestamp, type }]
   */
  async syncLogs(logs) {
    const results = {
      received: logs.length,
      created: 0,
      updated: 0,
      errors: 0
    };

    for (const log of logs) {
      try {
        const user = await User.findOne({ employeeId: log.employeeId });
        if (!user) {
          console.warn(`[Attendance] User not found for employeeId: ${log.employeeId}`);
          results.errors++;
          continue;
        }

        const timestamp = new Date(log.timestamp);
        
        // Upsert log to avoid duplicates
        await AttendanceLog.findOneAndUpdate(
          { userId: user._id, timestamp, type: log.type },
          { 
            userId: user._id, 
            employeeId: log.employeeId, 
            timestamp, 
            type: log.type,
            rawLog: log.raw || {}
          },
          { upsert: true, new: true }
        );
        results.created++;
      } catch (err) {
        console.error(`[Attendance] Sync error for log:`, log, err.message);
        results.errors++;
      }
    }

    return results;
  },

  /**
   * Get attendance for a user in a date range
   */
  async getAttendance(userId, from, to) {
    return await AttendanceLog.find({
      userId,
      timestamp: { $gte: new Date(from), $lte: new Date(to) }
    }).sort({ timestamp: 1 });
  }
};

module.exports = attendanceService;
