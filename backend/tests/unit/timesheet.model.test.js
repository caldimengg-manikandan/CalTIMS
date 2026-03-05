const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Timesheet = require('../../src/modules/timesheets/timesheet.model');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Timesheet Model isIncomplete Logic', () => {
  it('should calculate totalHours and set isIncomplete to true if < 40', async () => {
    const ts = new Timesheet({
      userId: new mongoose.Types.ObjectId(),
      weekStartDate: new Date('2025-01-01'),
      weekEndDate: new Date('2025-01-07'),
      rows: [
        {
          projectId: new mongoose.Types.ObjectId(),
          entries: [
            { date: new Date('2025-01-01'), hoursWorked: 8 },
            { date: new Date('2025-01-02'), hoursWorked: 8 }
          ]
        }
      ]
    });
    
    await ts.save();

    const savedTs = await Timesheet.findById(ts._id);
    expect(savedTs.totalHours).toBe(16);
    expect(savedTs.isIncomplete).toBe(true);
  });

  it('should set isIncomplete to false if >= 40', async () => {
    const ts = new Timesheet({
      userId: new mongoose.Types.ObjectId(),
      weekStartDate: new Date('2025-01-08'),
      weekEndDate: new Date('2025-01-14'),
      rows: [
        {
          projectId: new mongoose.Types.ObjectId(),
          entries: [
            { date: new Date('2025-01-08'), hoursWorked: 8 },
            { date: new Date('2025-01-09'), hoursWorked: 8 },
            { date: new Date('2025-01-10'), hoursWorked: 8 },
            { date: new Date('2025-01-11'), hoursWorked: 8 },
            { date: new Date('2025-01-12'), hoursWorked: 8 }
          ]
        }
      ]
    });
    
    await ts.save();

    const savedTs = await Timesheet.findById(ts._id);
    expect(savedTs.totalHours).toBe(40);
    expect(savedTs.isIncomplete).toBe(false);
  });
});
