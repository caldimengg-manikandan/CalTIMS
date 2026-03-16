'use strict';

/**
 * Hikvision Parser Utility
 * Converts Hikvision ISAPI events into internal format.
 */
const hikvisionParser = {
  /**
   * Parse a single event from Hikvision AcsEvent response.
   * Internal format: { employeeId, timestamp, type, raw }
   */
  parseEvent(event) {
    if (!event) return null;

    // Hikvision provides employeeNoString
    const employeeId = event.employeeNoString;
    
    // Hikvision provides time in ISO or YYYY-MM-DDTHH:mm:ss format
    const timestamp = new Date(event.time);
    
    if (isNaN(timestamp.getTime())) {
      console.warn(`[HikvisionParser] Invalid timestamp: ${event.time}`);
      return null;
    }

    // Default to check-in if minor interaction type is unclear
    // Major 5, Minor 1 is typical for "legal card verification"
    let type = 'check-in';
    
    // If the system distinguishes entry/exit via door/direction, we could map it here.
    // For now, we use a simple mapping or default to check-in.
    if (event.direction === 'exit' || event.minor === 3) {
      type = 'check-out';
    }

    return {
      employeeId,
      timestamp,
      type,
      raw: event
    };
  }
};

module.exports = hikvisionParser;
