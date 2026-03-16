'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const timesheetService = require('../../src/modules/timesheets/timesheet.service');
const Timesheet = require('../../src/modules/timesheets/timesheet.model');
const Settings = require('../../src/modules/settings/settings.model');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Permission Limits Validation', () => {
  let userId;

  beforeEach(async () => {
    await Timesheet.deleteMany({});
    await Settings.deleteMany({});
    userId = new mongoose.Types.ObjectId();
  });

  it('should allow permission within daily hours limit', async () => {
    await Settings.create({
      timesheet: { permissionMaxHoursPerDay: 2 },
      compliance: { allowBackdatedEntries: true }
    });

    const ts = new Timesheet({
      userId,
      weekStartDate: new Date('2025-01-01'),
      weekEndDate: new Date('2025-01-07'),
      rows: [{
        projectId: new mongoose.Types.ObjectId(),
        category: 'Permission',
        entries: [{ date: new Date('2025-01-01'), hoursWorked: 2 }]
      }]
    });

    await expect(timesheetService.validateLimits(ts)).resolves.not.toThrow();
  });

  it('should throw error if permission exceeds daily hours limit', async () => {
    await Settings.create({
      timesheet: { permissionMaxHoursPerDay: 2 },
      compliance: { allowBackdatedEntries: true }
    });

    const ts = new Timesheet({
      userId,
      weekStartDate: new Date('2025-01-01'),
      weekEndDate: new Date('2025-01-07'),
      rows: [{
        projectId: new mongoose.Types.ObjectId(),
        category: 'Permission',
        entries: [{ date: new Date('2025-01-01'), hoursWorked: 3 }]
      }]
    });

    await expect(timesheetService.validateLimits(ts)).rejects.toThrow(/Daily permission hour limit exceeded/);
  });

  it('should throw error if permission exceeds weekly days limit', async () => {
    await Settings.create({
      timesheet: { permissionMaxDaysPerWeek: 1 },
      compliance: { allowBackdatedEntries: true }
    });

    const ts = new Timesheet({
      userId,
      weekStartDate: new Date('2025-01-01'),
      weekEndDate: new Date('2025-01-07'),
      rows: [{
        projectId: new mongoose.Types.ObjectId(),
        category: 'Permission',
        entries: [
          { date: new Date('2025-01-01'), hoursWorked: 1 },
          { date: new Date('2025-01-02'), hoursWorked: 1 }
        ]
      }]
    });

    await expect(timesheetService.validateLimits(ts)).rejects.toThrow(/Weekly permission day limit exceeded/);
  });

  it('should throw error if permission exceeds monthly days limit across weeks', async () => {
     await Settings.create({
      timesheet: { permissionMaxDaysPerMonth: 2 },
      compliance: { allowBackdatedEntries: true }
    });

    // Existing timesheet for first week with 2 permission days
    const ts1 = new Timesheet({
      userId,
      weekStartDate: new Date('2025-01-01T00:00:00.000Z'),
      weekEndDate: new Date('2025-01-07T23:59:59.999Z'),
      rows: [{
        projectId: new mongoose.Types.ObjectId(),
        category: 'Permission',
        entries: [
          { date: new Date('2025-01-01T00:00:00.000Z'), hoursWorked: 1 },
          { date: new Date('2025-01-02T00:00:00.000Z'), hoursWorked: 1 }
        ]
      }]
    });
    await ts1.save();

    // New timesheet for second week trying to add another permission day
    const ts2 = new Timesheet({
      userId,
      weekStartDate: new Date('2025-01-08T00:00:00.000Z'),
      weekEndDate: new Date('2025-01-14T23:59:59.999Z'),
      rows: [{
        projectId: new mongoose.Types.ObjectId(),
        category: 'Permission',
        entries: [
          { date: new Date('2025-01-08T00:00:00.000Z'), hoursWorked: 1 }
        ]
      }]
    });

    await expect(timesheetService.validateLimits(ts2)).rejects.toThrow(/Monthly permission day limit exceeded/);
  });
});
