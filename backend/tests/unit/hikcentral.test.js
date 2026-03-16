'use strict';

const hikcentralParser = require('../../src/modules/attendance/hikcentral.parser');

describe('HikCentral Parser', () => {
  test('should correctly parse a valid check-in event', () => {
    const mockEvent = {
      employeeNo: 'CDE110',
      eventTime: '2026-03-13T08:40:00.000+05:30',
      doorName: 'Main Entrance'
    };

    const result = hikcentralParser.parseEvent(mockEvent);

    expect(result).toEqual({
      employeeId: 'CDE110',
      timestamp: new Date('2026-03-13T08:40:00.000+05:30'),
      type: 'check-in',
      raw: mockEvent
    });
  });

  test('should correctly parse a check-out event based on doorName', () => {
    const mockEvent = {
      employeeNo: 'CDE110',
      eventTime: '2026-03-13T18:00:00.000+05:30',
      doorName: 'Staff exit Gate'
    };

    const result = hikcentralParser.parseEvent(mockEvent);

    expect(result.type).toBe('check-out');
  });

  test('should return null for invalid timestamp', () => {
    const mockEvent = {
      employeeNo: 'CDE110',
      eventTime: 'invalid-date'
    };

    const result = hikcentralParser.parseEvent(mockEvent);
    expect(result).toBeNull();
  });
});
