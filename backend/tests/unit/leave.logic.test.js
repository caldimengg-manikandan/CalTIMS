'use strict';

/**
 * Unit tests for the leave-aware weekly hours calculator.
 *
 * Tests the `calculateWeeklyHours` function from timesheet.service.js
 * and the `resolveEntryHours` logic baked into timesheet.model.js's pre-save hook.
 *
 * Rules under test:
 *   Annual / Sick / Casual leave (balance > 0) → 8h per day (paid)
 *   LOP (balance = 0)                          → 0h per day
 *   Normal work entry                          → hoursWorked as stored
 *   Half-day paid leave                        → 4h
 *   Weekly total < 40                          → isIncomplete = true
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Timesheet = require('../../src/modules/timesheets/timesheet.model');
const { calculateWeeklyHours } = require('../../src/modules/timesheets/timesheet.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function makeRow({ projectId, entries }) {
  return { projectId: projectId || new mongoose.Types.ObjectId(), entries };
}

function workEntry(date, hours) {
  return { date: new Date(date), hoursWorked: hours, isLeave: false };
}

function leaveEntry(date, leaveType, hours = 8) {
  return { date: new Date(date), hoursWorked: hours, isLeave: true, leaveType };
}


// ─── calculateWeeklyHours (pure function tests) ───────────────────────────────
describe('calculateWeeklyHours – leave hour rules', () => {

  test('normal 5-day work week → 40 hours, not incomplete', () => {
    const rows = [makeRow({
      entries: [
        workEntry('2025-01-06', 8),
        workEntry('2025-01-07', 8),
        workEntry('2025-01-08', 8),
        workEntry('2025-01-09', 8),
        workEntry('2025-01-10', 8),
      ]
    })];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(40);
    expect(isIncomplete).toBe(false);
  });

  test('one paid annual leave day: work 4 days + 1 annual leave → 40 hours', () => {
    // Annual leave with balance > 0 counts as 8h paid
    const rows = [
      makeRow({
        entries: [
          workEntry('2025-01-06', 8),
          workEntry('2025-01-07', 8),
          workEntry('2025-01-08', 8),
          workEntry('2025-01-09', 8),
        ]
      }),
      makeRow({
        entries: [
          leaveEntry('2025-01-10', 'annual', 8), // paid leave
        ]
      })
    ];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(40);
    expect(isIncomplete).toBe(false);
  });

  test('one sick leave day: work 4 days + 1 sick leave → 40 hours', () => {
    const rows = [
      makeRow({ entries: [
        workEntry('2025-01-06', 8),
        workEntry('2025-01-07', 8),
        workEntry('2025-01-08', 8),
        workEntry('2025-01-09', 8),
        leaveEntry('2025-01-10', 'sick', 8),
      ] })
    ];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(40);
    expect(isIncomplete).toBe(false);
  });

  test('one casual leave day: work 4 days + 1 casual leave → 40 hours', () => {
    const rows = [
      makeRow({ entries: [
        workEntry('2025-01-06', 8),
        workEntry('2025-01-07', 8),
        workEntry('2025-01-08', 8),
        workEntry('2025-01-09', 8),
        leaveEntry('2025-01-10', 'casual', 8),
      ] })
    ];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(40);
    expect(isIncomplete).toBe(false);
  });

  test('one LOP day (no balance): work 4 days + 1 LOP → 32 hours, incomplete', () => {
    // LOP contributes 0h → weekly total = 32 → isIncomplete = true
    const rows = [
      makeRow({ entries: [
        workEntry('2025-01-06', 8),
        workEntry('2025-01-07', 8),
        workEntry('2025-01-08', 8),
        workEntry('2025-01-09', 8),
        leaveEntry('2025-01-10', 'lop', 0), // LOP: 0h
      ] })
    ];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(32);
    expect(isIncomplete).toBe(true);
  });

  test('half-day paid leave: 4 days work + half-day casual → 36 hours, incomplete', () => {
    const rows = [
      makeRow({ entries: [
        workEntry('2025-01-06', 8),
        workEntry('2025-01-07', 8),
        workEntry('2025-01-08', 8),
        workEntry('2025-01-09', 8),
        leaveEntry('2025-01-10', 'casual', 4), // half-day
      ] })
    ];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(36);
    expect(isIncomplete).toBe(true);
  });

  test('mixed: 3 work days + 1 annual leave + 1 LOP → 32 hours, incomplete', () => {
    const rows = [
      makeRow({ entries: [
        workEntry('2025-01-06', 8),
        workEntry('2025-01-07', 8),
        workEntry('2025-01-08', 8),
        leaveEntry('2025-01-09', 'annual', 8), // paid → 8h
        leaveEntry('2025-01-10', 'lop', 0),    // LOP → 0h
      ] })
    ];
    const { totalHours, isIncomplete } = calculateWeeklyHours(rows);
    expect(totalHours).toBe(32);
    expect(isIncomplete).toBe(true);
  });

  test('empty rows → 0 hours, incomplete', () => {
    const { totalHours, isIncomplete } = calculateWeeklyHours([]);
    expect(totalHours).toBe(0);
    expect(isIncomplete).toBe(true);
  });
});


// ─── Timesheet Model pre-save hook (integration with DB) ─────────────────────
describe('Timesheet Model – leave-aware pre-save totalHours', () => {
  const pid = () => new mongoose.Types.ObjectId();
  const uid = () => new mongoose.Types.ObjectId();

  test('paid annual leave entry contributes 8h to totalHours', async () => {
    const ts = new Timesheet({
      userId: uid(),
      weekStartDate: new Date('2025-02-03'),
      weekEndDate: new Date('2025-02-09'),
      rows: [{
        projectId: pid(),
        category: 'Annual',
        entries: [
          { date: new Date('2025-02-03'), hoursWorked: 8, isLeave: true, leaveType: 'annual' },
          { date: new Date('2025-02-04'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-05'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-06'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-07'), hoursWorked: 8, isLeave: false },
        ]
      }]
    });
    await ts.save();
    const saved = await Timesheet.findById(ts._id);
    expect(saved.totalHours).toBe(40);
    expect(saved.isIncomplete).toBe(false);
  });

  test('LOP entry contributes 0h → week is incomplete', async () => {
    const ts = new Timesheet({
      userId: uid(),
      weekStartDate: new Date('2025-02-10'),
      weekEndDate: new Date('2025-02-16'),
      rows: [{
        projectId: pid(),
        category: 'Lop',
        entries: [
          { date: new Date('2025-02-10'), hoursWorked: 0, isLeave: true, leaveType: 'lop' },
          { date: new Date('2025-02-11'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-12'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-13'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-14'), hoursWorked: 8, isLeave: false },
        ]
      }]
    });
    await ts.save();
    const saved = await Timesheet.findById(ts._id);
    expect(saved.totalHours).toBe(32);
    expect(saved.isIncomplete).toBe(true);
  });

  test('half-day sick leave contributes 4h', async () => {
    const ts = new Timesheet({
      userId: uid(),
      weekStartDate: new Date('2025-02-17'),
      weekEndDate: new Date('2025-02-23'),
      rows: [{
        projectId: pid(),
        entries: [
          { date: new Date('2025-02-17'), hoursWorked: 4, isLeave: true, leaveType: 'sick' }, // half-day
          { date: new Date('2025-02-18'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-19'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-20'), hoursWorked: 8, isLeave: false },
          { date: new Date('2025-02-21'), hoursWorked: 8, isLeave: false },
        ]
      }]
    });
    await ts.save();
    const saved = await Timesheet.findById(ts._id);
    expect(saved.totalHours).toBe(36);
    expect(saved.isIncomplete).toBe(true);
  });
});
