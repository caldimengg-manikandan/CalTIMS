'use strict';

/**
 * Seed Script — TimesheetPro
 * Usage: node seed.js
 * Run from the backend/ directory with a valid .env configured.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Import Models ────────────────────────────────────────────────────────────
const User         = require('./src/modules/users/user.model');
const Project      = require('./src/modules/projects/project.model');
const Timesheet    = require('./src/modules/timesheets/timesheet.model');
const Leave        = require('./src/modules/leaves/leave.model');
const Announcement = require('./src/modules/announcements/announcement.model');
const CalendarEvent = require('./src/modules/calendar/calendar.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/timesheet_db';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hash = (pw) => bcrypt.hash(pw, 12);

const getWeekStartUTC = (weeksAgo = 0) => {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun
  // ISO week starts on Monday (1). 
  // If today is Sun (0), go back 6 days. Otherwise back to Monday (day - 1).
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff - weeksAgo * 7);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d);
};

const addDaysUTC = (date, n) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected:', MONGO_URI);

  // ── Wipe existing data ─────────────────────────────────────────────────────
  console.log('\n🗑  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Timesheet.deleteMany({}),
    Leave.deleteMany({}),
    Announcement.deleteMany({}),
    CalendarEvent.deleteMany({}),
  ]);
  console.log('✅ Collections cleared');

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('\n👤 Creating users...');

  const [adminPw, managerPw, emp1Pw, emp2Pw, emp3Pw] = await Promise.all([
    hash('Admin@1234'),
    hash('Manager@1234'),
    hash('Employee@1234'),
    hash('Employee@1234'),
    hash('Employee@1234'),
  ]);

  const [admin, manager, emp1, emp2, emp3] = await User.insertMany([
    {
      employeeId: 'EMP0001',
      name: 'Alice Admin',
      email: 'admin@timesheetpro.com',
      password: adminPw,
      role: 'admin',
      department: 'Management',
      designation: 'System Administrator',
      phone: '+91-9000000001',
      joiningDate: new Date('2022-01-01'),
      isActive: true,
      leaveBalance: { annual: 18, sick: 10, casual: 7 },
    },
    {
      employeeId: 'EMP0002',
      name: 'Bob Manager',
      email: 'manager@timesheetpro.com',
      password: managerPw,
      role: 'manager',
      department: 'Engineering',
      designation: 'Project Manager',
      phone: '+91-9000000002',
      joiningDate: new Date('2022-03-15'),
      isActive: true,
      leaveBalance: { annual: 15, sick: 8, casual: 6 },
    },
    {
      employeeId: 'EMP0003',
      name: 'Carol Developer',
      email: 'carol@timesheetpro.com',
      password: emp1Pw,
      role: 'employee',
      department: 'Engineering',
      designation: 'Senior Software Engineer',
      phone: '+91-9000000003',
      joiningDate: new Date('2022-06-01'),
      isActive: true,
      leaveBalance: { annual: 12, sick: 8, casual: 5 },
    },
    {
      employeeId: 'EMP0004',
      name: 'David Designer',
      email: 'david@timesheetpro.com',
      password: emp2Pw,
      role: 'employee',
      department: 'Design',
      designation: 'UI/UX Designer',
      phone: '+91-9000000004',
      joiningDate: new Date('2023-01-10'),
      isActive: true,
      leaveBalance: { annual: 10, sick: 8, casual: 4 },
    },
    {
      employeeId: 'EMP0005',
      name: 'Eva QA',
      email: 'eva@timesheetpro.com',
      password: emp3Pw,
      role: 'employee',
      department: 'Quality Assurance',
      designation: 'QA Engineer',
      phone: '+91-9000000005',
      joiningDate: new Date('2023-04-01'),
      isActive: true,
      leaveBalance: { annual: 9, sick: 8, casual: 3 },
    },
  ]);

  console.log(`✅ Created ${5} users`);

  // ── Projects ───────────────────────────────────────────────────────────────
  console.log('\n📁 Creating projects...');

  const [proj1, proj2, proj3] = await Project.insertMany([
    {
      name: 'TimesheetPro Platform',
      code: 'TSP-001',
      description: 'Internal MERN stack timesheet management system',
      clientName: 'Internal',
      status: 'active',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      budget: 500000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp1._id, role: 'developer', allocationPercent: 100, startDate: new Date('2024-01-01') },
        { userId: emp2._id, role: 'designer',  allocationPercent: 50,  startDate: new Date('2024-01-01') },
        { userId: emp3._id, role: 'qa',        allocationPercent: 40,  startDate: new Date('2024-01-01') },
        { userId: manager._id, role: 'manager', allocationPercent: 20, startDate: new Date('2024-01-01') },
      ],
    },
    {
      name: 'E-Commerce Revamp',
      code: 'ECR-002',
      description: 'Complete redesign of client e-commerce portal',
      clientName: 'RetailCorp Ltd.',
      status: 'active',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-09-30'),
      budget: 750000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp1._id, role: 'developer', allocationPercent: 75, startDate: new Date('2024-03-01') },
        { userId: emp2._id, role: 'designer',  allocationPercent: 100, startDate: new Date('2024-03-01') },
      ],
    },
    {
      name: 'Mobile App MVP',
      code: 'MAP-003',
      description: 'React Native MVP for logistics startup',
      clientName: 'LogiTech Solutions',
      status: 'on-hold',
      startDate: new Date('2024-05-01'),
      budget: 300000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp3._id, role: 'qa', allocationPercent: 100, startDate: new Date('2024-05-01') },
      ],
    },
  ]);

  console.log('✅ Created 3 projects');

  // ── Timesheets ─────────────────────────────────────────────────────────────
  console.log('\n⏱  Creating timesheets...');

  const makeEntries = (weekStart, hours = [8, 8, 8, 8, 8, 0, 0]) =>
    hours.map((h, i) => ({
      date: addDaysUTC(weekStart, i),
      hoursWorked: h,
      description: h > 0 ? 'Development work' : '',
    }));

  const week0 = getWeekStartUTC(0);
  const week1 = getWeekStartUTC(1);
  const week2 = getWeekStartUTC(2);
  const week3 = getWeekStartUTC(3);

  const timesheets = [
    // Carol — current week (draft)
    new Timesheet({
      userId: emp1._id,
      weekStartDate: week0, weekEndDate: addDaysUTC(week0, 6),
      status: 'draft', 
      rows: [
        { projectId: proj1._id, category: 'Development', entries: makeEntries(week0, [8, 7, 8, 6, 0, 0, 0]) }
      ]
    }),
    // Carol — last week (submitted)
    new Timesheet({
      userId: emp1._id,
      weekStartDate: week1, weekEndDate: addDaysUTC(week1, 6),
      status: 'submitted', submittedAt: new Date(),
      rows: [
        { projectId: proj1._id, category: 'Development', entries: makeEntries(week1) }
      ]
    }),
    // Carol — 2 weeks ago (approved)
    new Timesheet({
      userId: emp1._id,
      weekStartDate: week2, weekEndDate: addDaysUTC(week2, 6),
      status: 'approved', submittedAt: addDaysUTC(week2, 5), approvedBy: manager._id,
      approvedAt: addDaysUTC(week2, 6),
      rows: [
        { projectId: proj2._id, category: 'Research', entries: makeEntries(week2) }
      ]
    }),
    // David — last week (approved)
    new Timesheet({
      userId: emp2._id,
      weekStartDate: week1, weekEndDate: addDaysUTC(week1, 6),
      status: 'approved', submittedAt: addDaysUTC(week1, 5), approvedBy: manager._id,
      approvedAt: addDaysUTC(week1, 6),
      rows: [
        { projectId: proj1._id, category: 'Design', entries: makeEntries(week1, [6, 6, 6, 6, 6, 0, 0]) }
      ]
    }),
    // Eva — last week (rejected)
    new Timesheet({
      userId: emp3._id,
      weekStartDate: week1, weekEndDate: addDaysUTC(week1, 6),
      status: 'rejected', submittedAt: addDaysUTC(week1, 5),
      rejectionReason: 'Hours do not match project logs. Please resubmit.',
      rows: [
        { projectId: proj3._id, category: 'QA', entries: makeEntries(week1, [4, 0, 4, 0, 4, 0, 0]) }
      ]
    }),
    // Manager — 3 weeks ago (approved)
    new Timesheet({
      userId: manager._id,
      weekStartDate: week3, weekEndDate: addDaysUTC(week3, 6),
      status: 'approved', submittedAt: addDaysUTC(week3, 5), approvedBy: admin._id,
      approvedAt: addDaysUTC(week3, 6),
      rows: [
        { projectId: proj1._id, category: 'Management', entries: makeEntries(week3, [5, 5, 5, 5, 5, 0, 0]) }
      ]
    }),
  ];

  // Save each to trigger pre-save hook for totals
  for (const ts of timesheets) {
    await ts.save();
  }


  console.log(`✅ Created ${timesheets.length} timesheets`);

  // ── Leaves ─────────────────────────────────────────────────────────────────
  console.log('\n🌴 Creating leave records...');

  const leavesData = [
    {
      userId: emp1._id,
      leaveType: 'annual',
      startDate: addDaysUTC(new Date(), 7),
      endDate: addDaysUTC(new Date(), 9),
      totalDays: 3,
      reason: 'Family vacation',
      status: 'pending',
    },
    {
      userId: emp2._id,
      leaveType: 'sick',
      startDate: addDaysUTC(new Date(), -5),
      endDate: addDaysUTC(new Date(), -5),
      totalDays: 1,
      reason: 'Fever',
      status: 'approved',
      approvedBy: manager._id,
      approvedAt: addDaysUTC(new Date(), -4),
    },
    {
      userId: emp3._id,
      leaveType: 'casual',
      startDate: addDaysUTC(new Date(), 14),
      endDate: addDaysUTC(new Date(), 16),
      totalDays: 3,
      reason: 'Personal work',
      status: 'pending',
    },
  ];

  for (const lData of leavesData) {
    const leave = new Leave(lData);
    await leave.save();
  }

  console.log('✅ Created 3 leave records');

  // ── Announcements ──────────────────────────────────────────────────────────
  console.log('\n📢 Creating announcements...');

  await Announcement.insertMany([
    {
      title: 'Welcome to TimesheetPro!',
      content: 'We\'ve launched our new internal timesheet management system. Please log your hours weekly and submit by Friday 5 PM for manager review.',
      type: 'info',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: '⚠ Timesheet Submission Deadline Reminder',
      content: 'All timesheets for the current week must be submitted by this Friday. Unsubmitted timesheets will be escalated to your manager.',
      type: 'warning',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: ['employee'],
      expiresAt: addDaysUTC(new Date(), 7),
    },
    {
      title: '🚨 System Maintenance Tonight',
      content: 'The TimesheetPro system will be offline for maintenance from 11 PM to 1 AM IST. Please save your work before then.',
      type: 'urgent',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
      expiresAt: addDaysUTC(new Date(), 1),
    },
  ]);

  console.log('✅ Created 3 announcements');

  // ── Calendar Events ────────────────────────────────────────────────────────
  console.log('\n📅 Creating calendar events...');

  await CalendarEvent.insertMany([
    {
      title: 'Republic Day',
      eventType: 'holiday',
      startDate: new Date('2026-01-26'),
      endDate: new Date('2026-01-26'),
      color: '#ef4444',
      isPublic: true,
      createdBy: admin._id,
    },
    {
      title: 'Q1 Sprint Planning',
      eventType: 'meeting',
      startDate: addDaysUTC(week0, 1), // This Tuesday
      endDate: addDaysUTC(week0, 1),
      color: '#6366f1',
      isPublic: true,
      description: 'All-hands sprint planning for Q1 deliverables',
      createdBy: admin._id,
    },
    {
      title: 'Team Outing',
      eventType: 'company-event',
      startDate: addDaysUTC(new Date(), 21),
      endDate: addDaysUTC(new Date(), 21),
      color: '#22c55e',
      isPublic: true,
      description: 'Annual team outing at Wonderla',
      createdBy: manager._id,
    },
    {
      title: 'Holi',
      eventType: 'holiday',
      startDate: new Date('2026-03-04'),
      endDate: new Date('2026-03-04'),
      color: '#f59e0b',
      isPublic: true,
      createdBy: admin._id,
    },
  ]);

  console.log('✅ Created 4 calendar events');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log(' Login Credentials');
  console.log('─────────────────────────────────────────────');
  console.log(' Role     | Email                          | Password');
  console.log('─────────────────────────────────────────────');
  console.log(' Admin    | admin@timesheetpro.com         | Admin@1234');
  console.log(' Manager  | manager@timesheetpro.com       | Manager@1234');
  console.log(' Employee | carol@timesheetpro.com         | Employee@1234');
  console.log(' Employee | david@timesheetpro.com         | Employee@1234');
  console.log(' Employee | eva@timesheetpro.com           | Employee@1234');
  console.log('─────────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
