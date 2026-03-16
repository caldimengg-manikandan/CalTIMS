'use strict';

const hikvisionParser = require('../../src/modules/attendance/hikvision.parser');

describe('Hikvision Parser', () => {
  test('should correctly parse a valid check-in event', () => {
    const mockEvent = {
      employeeNoString: '101',
      time: '2026-03-13T09:00:00Z',
      direction: 'entry',
      minor: 1
    };

    const result = hikvisionParser.parseEvent(mockEvent);

    expect(result).toEqual({
      employeeId: '101',
      timestamp: new Date('2026-03-13T09:00:00Z'),
      type: 'check-in',
      raw: mockEvent
    });
  });

  test('should correctly parse a check-out event based on direction', () => {
    const mockEvent = {
      employeeNoString: '102',
      time: '2026-03-13T18:00:00Z',
      direction: 'exit'
    };

    const result = hikvisionParser.parseEvent(mockEvent);

    expect(result.type).toBe('check-out');
  });

  test('should return null for invalid timestamp', () => {
    const mockEvent = {
      employeeNoString: '101',
      time: 'invalid-date'
    };

    const result = hikvisionParser.parseEvent(mockEvent);
    expect(result).toBeNull();
  });
});
