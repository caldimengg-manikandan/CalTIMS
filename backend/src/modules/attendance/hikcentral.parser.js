'use strict';

/**
 * HikCentral Parser Utility
 * Converts Artemis API events into internal format.
 */
const hikcentralParser = {
  /**
   * Parse a single event from Artemis event logs.
   * Artemis format: { employeeNo, eventTime, doorName, cardNo, ... }
   */
  /**
   * Parse check-in from report record.
   */
  parseEvent(record) {
    if (!record || !record.attendanceBaseInfo?.beginTime) return null;

    const personInfo = record.personInfo || {};
    const attendanceInfo = record.attendanceBaseInfo;
    const employeeId = personInfo.personCode || personInfo.personID;
    const timestamp = new Date(attendanceInfo.beginTime);

    if (!employeeId || isNaN(timestamp.getTime())) return null;

    return {
      employeeId,
      timestamp,
      type: 'check-in',
      raw: record
    };
  },

  /**
   * Parse check-out from report record.
   */
  parseCheckout(record) {
    if (!record || !record.attendanceBaseInfo?.endTime) return null;

    const personInfo = record.personInfo || {};
    const attendanceInfo = record.attendanceBaseInfo;
    const employeeId = personInfo.personCode || personInfo.personID;
    const timestamp = new Date(attendanceInfo.endTime);

    if (!employeeId || isNaN(timestamp.getTime())) return null;

    return {
      employeeId,
      timestamp,
      type: 'check-out',
      raw: record
    };
  }
};

module.exports = hikcentralParser;
