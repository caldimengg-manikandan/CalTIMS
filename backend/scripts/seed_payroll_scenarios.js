'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/modules/users/user.model');
const PayrollProfile = require('../src/modules/payroll/payrollProfile.model');
const RoleSalaryStructure = require('../src/modules/payroll/roleSalaryStructure.model');
const Timesheet = require('../src/modules/timesheets/timesheet.model');
const Leave = require('../src/modules/leaves/leave.model');
const Project = require('../src/modules/projects/project.model');
const Settings = require('../src/modules/settings/settings.model');
const { ROLES, TIMESHEET_STATUS } = require('../src/constants');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/timesheet_db';

async function seedScenarios() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  console.log('🗑  Clearing existing test data for March 2026 scenarios...');
  const testEmails = [
    'fixed@test.com', 'hourly@test.com', 'lop@test.com', 'overtime@test.com',
    'zero@test.com', 'partial@test.com', 'high_deduction@test.com', 'mixed@test.com'
  ];
  
  const existingUsers = await User.find({ email: { $in: testEmails } });
  const userIds = existingUsers.map(u => u._id);

  await Promise.all([
    User.deleteMany({ email: { $in: testEmails } }),
    PayrollProfile.deleteMany({ user: { $in: userIds } }),
    RoleSalaryStructure.deleteMany({ 
      $or: [
        { userId: { $in: userIds } },
        { name: /Structure$/ }
      ]
    }),
    Timesheet.deleteMany({ userId: { $in: userIds } }),
    Leave.deleteMany({ userId: { $in: userIds } })
  ]);

  // Ensure settings allow overtime for the overtime test
  await Settings.findOneAndUpdate({}, {
    'payroll.overtimeEnabled': true,
    'payroll.overtimeRate': 1.5,
    'payroll.workingDaysPerMonth': 22,
    'payroll.standardHoursPerDay': 8,
    'payroll.taxToggles.pf': true,
    'payroll.taxToggles.esi': true,
    'payroll.taxToggles.tds': true
  }, { upsert: true });

  // Create a Project for timesheets
  let project = await Project.findOne({ code: 'TEST-PAYROLL' });
  if (project) {
    await Project.deleteOne({ _id: project._id });
  }

  // We need a manager for the project. Let's create a dummy admin.
  let admin = await User.findOne({ email: 'admin@test.com' });
  if (!admin) {
    admin = new User({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'Password@123',
      role: ROLES.ADMIN,
      isActive: true,
      joinDate: new Date('2020-01-01')
    });
    await admin.save();
  }

  project = new Project({
    name: 'Payroll Test Project',
    code: 'TEST-PAYROLL',
    status: 'active',
    startDate: new Date('2020-01-01'),
    managerId: admin._id,
    allocatedEmployees: []
  });
  await project.save();

  // Give Admin a profile to avoid execution halt if processed
  await PayrollProfile.findOneAndUpdate(
    { user: admin._id },
    {
      user: admin._id,
      monthlyCTC: 100000,
      payrollType: 'Monthly',
      salaryMode: 'Role-Based',
      isActive: true
    },
    { upsert: true }
  );

  // Ensure 'Admin' role structure exists
  let adminStructure = await RoleSalaryStructure.findOne({ name: 'Admin', type: 'Role-Based' });
  if (!adminStructure) {
    adminStructure = new RoleSalaryStructure({
      name: 'Admin',
      type: 'Role-Based',
      earnings: [
        { name: 'Basic Salary', value: 40, calculationType: 'Percentage', formula: 'CTC' },
        { name: 'HRA', value: 40, calculationType: 'Percentage', formula: 'BASIC' }
      ],
      deductions: []
    });
    await adminStructure.save();
  }

  const scenarioData = [
    {
      name: 'Monthly Fixed',
      email: 'fixed@test.com',
      monthlyCTC: 50000,
      payrollType: 'Monthly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'full'
    },
    {
      name: 'Hourly Employee',
      email: 'hourly@test.com',
      hourlyRate: 500,
      payrollType: 'Hourly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'full'
    },
    {
      name: 'LOP Employee',
      email: 'lop@test.com',
      monthlyCTC: 60000,
      payrollType: 'Monthly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'lop'
    },
    {
      name: 'Overtime Employee',
      email: 'overtime@test.com',
      monthlyCTC: 40000,
      payrollType: 'Monthly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'overtime'
    },
    {
      name: 'Zero Attendance',
      email: 'zero@test.com',
      monthlyCTC: 45000,
      payrollType: 'Monthly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'zero'
    },
    {
      name: 'Partial Month Joiner',
      email: 'partial@test.com',
      monthlyCTC: 70000,
      payrollType: 'Monthly',
      joinDate: new Date('2026-03-15'), // Joined mid-month
      attendanceCase: 'full' // but only for joined period
    },
    {
      name: 'High Deduction',
      email: 'high_deduction@test.com',
      monthlyCTC: 200000,
      payrollType: 'Monthly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'full'
    },
    {
      name: 'Mixed Components',
      email: 'mixed@test.com',
      monthlyCTC: 80000,
      payrollType: 'Monthly',
      joinDate: new Date('2025-01-01'),
      attendanceCase: 'full',
      customStructure: true
    }
  ];

  console.log('👤 Creating users and profiles...');
  for (const data of scenarioData) {
    const user = new User({
      name: data.name,
      email: data.email,
      password: 'Password@123',
      role: ROLES.EMPLOYEE,
      department: 'Engineering',
      designation: 'Tester',
      joinDate: data.joinDate,
      isActive: true,
      bankName: 'Test Bank',
      accountNumber: '123456789',
      ifscCode: 'TEST0001'
    });
    await user.save();

    const profile = new PayrollProfile({
      user: user._id,
      monthlyCTC: data.monthlyCTC || 0,
      hourlyRate: data.hourlyRate || 0,
      payrollType: data.payrollType,
      salaryMode: 'Employee-Based',
      isActive: true
    });
    await profile.save();

    // Create Salary Structure
    const structure = new RoleSalaryStructure({
      name: `${data.name} Structure`,
      type: 'Employee-Based',
      userId: user._id,
      earnings: [
        { name: 'Basic Salary', value: 40, calculationType: 'Percentage', formula: 'CTC' },
        { name: 'HRA', value: 40, calculationType: 'Percentage', formula: 'BASIC' },
        { name: 'Special Allowance', value: 2000, calculationType: 'Fixed' }
      ],
      deductions: [
        { name: 'PF', value: 12, calculationType: 'Percentage', formula: 'BASIC' },
        { name: 'Professional Tax', value: 200, calculationType: 'Fixed' }
      ]
    });

    if (data.customStructure) {
      structure.earnings.push({
        name: 'Technical Bonus',
        value: 0,
        calculationType: 'Formula',
        formula: 'BASIC * 0.1'
      });
    }

    await structure.save();

    // Generate Timesheets for March 2026
    if (data.attendanceCase !== 'zero') {
      const weeks = [
        { start: '2026-03-02', end: '2026-03-08' },
        { start: '2026-03-09', end: '2026-03-15' },
        { start: '2026-03-16', end: '2026-03-22' },
        { start: '2026-03-23', end: '2026-03-29' }
      ];

      for (const week of weeks) {
        const weekStart = new Date(week.start);
        
        // Skip if employee hasn't joined yet
        if (data.joinDate > new Date(week.end)) continue;

        const ts = new Timesheet({
          userId: user._id,
          weekStartDate: weekStart,
          weekEndDate: new Date(week.end),
          status: TIMESHEET_STATUS.APPROVED,
          rows: [{
            projectId: project._id,
            entries: [0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
              const date = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
              let hours = (dayOffset < 5) ? 8 : 0; // Mon-Fri 8 hours

              if (date < data.joinDate) hours = 0;

              if (data.attendanceCase === 'overtime' && dayOffset === 0) hours += 10; // Extra 10 hours in week 1
              
              let isLop = false;
              let leaveType = null;
              if (data.attendanceCase === 'lop' && (week.start === '2026-03-09') && (dayOffset === 1 || dayOffset === 2)) {
                hours = 0;
                isLop = true;
                leaveType = 'lop';
              }

              return {
                date,
                hoursWorked: hours,
                isLeave: isLop,
                leaveType
              };
            })
          }]
        });
        await ts.save();
      }
    }
  }

  console.log('✅ Seeding complete for 8 scenarios.');
  await mongoose.disconnect();
}

seedScenarios().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
