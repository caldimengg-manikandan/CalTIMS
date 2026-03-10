const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Timesheet = require('../../../src/modules/timesheets/timesheet.model');
const Project = require('../../../src/modules/projects/project.model');
const User = require('../../../src/modules/users/user.model');
const Settings = require('../../../src/modules/settings/settings.model');
const timesheetService = require('../../../src/modules/timesheets/timesheet.service');
const notificationService = require('../../../src/modules/notifications/notification.service');
const emailService = require('../../../src/shared/services/email.service');
const { TIMESHEET_STATUS, ROLES } = require('../../../src/constants');

jest.mock('../../../src/modules/notifications/notification.service');
jest.mock('../../../src/shared/services/email.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Project.deleteMany({});
  await Timesheet.deleteMany({});
  await User.deleteMany({});
  await Settings.deleteMany({});
  await Settings.create({
    general: { workingHoursPerDay: 8, isWeekendWorkable: false, weekStartDay: 'monday' }
  });
  jest.clearAllMocks();
});

describe('timesheetService.checkProjectBudget', () => {
  it('should trigger notification and email when budget is exceeded', async () => {
    // 1. Setup Data
    const manager = await User.create({
      name: 'Manager One',
      email: 'manager@example.com',
      employeeId: 'M001',
      role: ROLES.MANAGER,
      password: 'password123'
    });

    const admin = await User.create({
        name: 'Admin One',
        email: 'admin@example.com',
        employeeId: 'A001',
        role: ROLES.ADMIN,
        password: 'password123'
    });

    const project = await Project.create({
      name: 'Test Project',
      code: 'TP-001',
      managerId: manager._id,
      startDate: new Date(),
      budgetHours: 10
    });

    // Create approved timesheets totaling 12 hours
    await Timesheet.create({
      userId: new mongoose.Types.ObjectId(),
      weekStartDate: new Date('2025-01-01'),
      weekEndDate: new Date('2025-01-07'),
      status: TIMESHEET_STATUS.APPROVED,
      rows: [{
        projectId: project._id,
        totalHours: 12,
        entries: [{ date: new Date('2025-01-01'), hoursWorked: 12 }]
      }]
    });

    // 2. Execute
    await timesheetService.checkProjectBudget(project._id);

    // 3. Verify
    expect(notificationService.create).toHaveBeenCalled();
    expect(emailService.sendBudgetExceededEmail).toHaveBeenCalled();
    
    // Check if called for both admin and manager
    const notificationCalls = notificationService.create.mock.calls;
    const notifiedUserIds = notificationCalls.map(call => call[0].userId.toString());
    expect(notifiedUserIds).toContain(manager._id.toString());
    expect(notifiedUserIds).toContain(admin._id.toString());
  });

  it('should NOT trigger notification when budget is NOT exceeded', async () => {
    const manager = await User.create({
      name: 'Manager Two',
      email: 'manager2@example.com',
      employeeId: 'M002',
      role: ROLES.MANAGER,
      password: 'password123'
    });

    const project = await Project.create({
      name: 'Test Project 2',
      code: 'TP-002',
      managerId: manager._id,
      startDate: new Date(),
      budgetHours: 20
    });

    await Timesheet.create({
      userId: new mongoose.Types.ObjectId(),
      weekStartDate: new Date('2025-01-01'),
      weekEndDate: new Date('2025-01-07'),
      status: TIMESHEET_STATUS.APPROVED,
      rows: [{
        projectId: project._id,
        totalHours: 15,
        entries: [{ date: new Date('2025-01-01'), hoursWorked: 15 }]
      }]
    });

    await timesheetService.checkProjectBudget(project._id);

    expect(notificationService.create).not.toHaveBeenCalled();
    expect(emailService.sendBudgetExceededEmail).not.toHaveBeenCalled();
  });
});
