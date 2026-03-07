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
const Incident     = require('./src/modules/incidents/incident.model');
const Task         = require('./src/modules/tasks/task.model');
const Settings     = require('./src/modules/settings/settings.model');

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
    Incident.deleteMany({}),
    Task.deleteMany({}),
    Settings.deleteMany({}),
  ]);
  console.log('✅ Collections cleared');

  // ── Settings ──────────────────────────────────────────────────────────────
  console.log('\n⚙️  Creating settings...');
  await new Settings({}).save();
  console.log('✅ Default settings created');

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('\n👤 Creating users...');

  const [adminPw, managerPw, empPw] = await Promise.all([
    hash('Admin@1234'),
    hash('Manager@1234'),
    hash('Employee@1234'),
  ]);

  const [admin, manager, emp1, emp2, emp3, emp4, emp5, emp6, emp7, emp8] = await User.insertMany([
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
      password: empPw,
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
      password: empPw,
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
      password: empPw,
      role: 'employee',
      department: 'Quality Assurance',
      designation: 'QA Engineer',
      phone: '+91-9000000005',
      joiningDate: new Date('2023-04-01'),
      isActive: true,
      leaveBalance: { annual: 9, sick: 8, casual: 3 },
    },
    {
      employeeId: 'EMP0006',
      name: 'Frank Frontend',
      email: 'frank@timesheetpro.com',
      password: empPw,
      role: 'employee',
      department: 'Engineering',
      designation: 'Frontend Developer',
      phone: '+91-9000000006',
      joiningDate: new Date('2023-05-15'),
      isActive: true,
      leaveBalance: { annual: 10, sick: 5, casual: 2 },
    },
    {
      employeeId: 'EMP0007',
      name: 'Grace Backend',
      email: 'grace@timesheetpro.com',
      password: empPw,
      role: 'employee',
      department: 'Engineering',
      designation: 'Backend Developer',
      phone: '+91-9000000007',
      joiningDate: new Date('2023-06-01'),
      isActive: true,
      leaveBalance: { annual: 11, sick: 6, casual: 3 },
    },
    {
      employeeId: 'EMP0008',
      name: 'Henry HR',
      email: 'henry@timesheetpro.com',
      password: empPw,
      role: 'employee',
      department: 'HR',
      designation: 'HR Specialist',
      phone: '+91-9000000008',
      joiningDate: new Date('2023-07-20'),
      isActive: true,
      leaveBalance: { annual: 12, sick: 7, casual: 4 },
    },
    {
      employeeId: 'EMP0009',
      name: 'Ivy DevOps',
      email: 'ivy@timesheetpro.com',
      password: empPw,
      role: 'employee',
      department: 'Infrastructure',
      designation: 'DevOps Engineer',
      phone: '+91-9000000009',
      joiningDate: new Date('2023-08-10'),
      isActive: true,
      leaveBalance: { annual: 13, sick: 8, casual: 5 },
    },
    {
      employeeId: 'EMP0010',
      name: 'Jack Marketing',
      email: 'jack@timesheetpro.com',
      password: empPw,
      role: 'employee',
      department: 'Marketing',
      designation: 'Marketing Executive',
      phone: '+91-9000000010',
      joiningDate: new Date('2023-09-01'),
      isActive: true,
      leaveBalance: { annual: 14, sick: 9, casual: 6 },
    },
  ]);

  console.log(`✅ Created ${10} users`);

  // ── Projects ───────────────────────────────────────────────────────────────
  console.log('\n📁 Creating projects...');

  const [proj1, proj2, proj3, proj4, proj5, proj6, proj7, proj8, proj9, proj10] = await Project.insertMany([
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
    {
      name: 'AI Chatbot Integration',
      code: 'AIC-004',
      description: 'Integrating LLMs into customer support',
      clientName: 'TechGenix',
      status: 'active',
      startDate: new Date('2024-06-01'),
      budget: 450000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp4._id, role: 'developer', allocationPercent: 100, startDate: new Date('2024-06-01') },
      ],
    },
    {
      name: 'Cloud Migration',
      code: 'CLM-005',
      description: 'Migrating legacy servers to AWS',
      clientName: 'Financial Services Inc.',
      status: 'active',
      startDate: new Date('2024-02-01'),
      budget: 1200000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp5._id, role: 'developer', allocationPercent: 80, startDate: new Date('2024-02-01') },
      ],
    },
    {
      name: 'Cybersecurity Audit',
      code: 'CYB-006',
      description: 'Full security patch and vulnerability assessment',
      clientName: 'SafeBank',
      status: 'completed',
      startDate: new Date('2023-11-01'),
      endDate: new Date('2024-01-31'),
      budget: 200000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp6._id, role: 'qa', allocationPercent: 100, startDate: new Date('2023-11-01') },
      ],
    },
    {
      name: 'Inventory Management',
      code: 'INV-007',
      description: 'Custom ERP for manufacturing client',
      clientName: 'BuildIt Co.',
      status: 'active',
      startDate: new Date('2024-01-15'),
      budget: 900000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp7._id, role: 'developer', allocationPercent: 100, startDate: new Date('2024-01-15') },
      ],
    },
    {
      name: 'Marketing Analytics Dashboard',
      code: 'MAD-008',
      description: 'Real-time data visualization tool',
      clientName: 'AdGlobal',
      status: 'active',
      startDate: new Date('2024-04-01'),
      budget: 350000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp8._id, role: 'developer', allocationPercent: 50, startDate: new Date('2024-04-01') },
      ],
    },
    {
      name: 'Legacy System Support',
      code: 'LSS-009',
      description: 'Maintenance for old COBOL systems',
      clientName: 'GovDept',
      status: 'active',
      startDate: new Date('2023-01-01'),
      budget: 150000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp1._id, role: 'developer', allocationPercent: 25, startDate: new Date('2023-01-01') },
      ],
    },
    {
      name: 'SEO Enhancement',
      code: 'SEO-010',
      description: 'Improving search engine rankings',
      clientName: 'MarketReach',
      status: 'active',
      startDate: new Date('2024-05-15'),
      budget: 100000,
      managerId: manager._id,
      allocatedEmployees: [
        { userId: emp2._id, role: 'developer', allocationPercent: 50, startDate: new Date('2024-05-15') },
      ],
    },
  ]);

  console.log('✅ Created 10 projects');

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
    // Frank — last week (submitted)
    new Timesheet({
      userId: emp4._id,
      weekStartDate: week1, weekEndDate: addDaysUTC(week1, 6),
      status: 'submitted', submittedAt: new Date(),
      rows: [
        { projectId: proj4._id, category: 'Development', entries: makeEntries(week1) }
      ]
    }),
    // Grace — last week (approved)
    new Timesheet({
      userId: emp5._id,
      weekStartDate: week1, weekEndDate: addDaysUTC(week1, 6),
      status: 'approved', submittedAt: addDaysUTC(week1, 5), approvedBy: manager._id,
      approvedAt: addDaysUTC(week1, 6),
      rows: [
        { projectId: proj5._id, category: 'Infrastructure', entries: makeEntries(week1) }
      ]
    }),
    // Henry — last week (draft)
    new Timesheet({
      userId: emp6._id,
      weekStartDate: week0, weekEndDate: addDaysUTC(week0, 6),
      status: 'draft',
      rows: [
        { projectId: proj6._id, category: 'Audit', entries: makeEntries(week0, [4, 4, 4, 4, 4, 0, 0]) }
      ]
    }),
    // Ivy — last week (approved)
    new Timesheet({
      userId: emp7._id,
      weekStartDate: week1, weekEndDate: addDaysUTC(week1, 6),
      status: 'approved', submittedAt: addDaysUTC(week1, 5), approvedBy: manager._id,
      approvedAt: addDaysUTC(week1, 6),
      rows: [
        { projectId: proj7._id, category: 'DevOps', entries: makeEntries(week1) }
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
    {
      userId: emp4._id,
      leaveType: 'annual',
      startDate: addDaysUTC(new Date(), 20),
      endDate: addDaysUTC(new Date(), 25),
      totalDays: 6,
      reason: 'Marriage',
      status: 'pending',
    },
    {
      userId: emp5._id,
      leaveType: 'sick',
      startDate: addDaysUTC(new Date(), -10),
      endDate: addDaysUTC(new Date(), -10),
      totalDays: 1,
      reason: 'Dental checkup',
      status: 'approved',
      approvedBy: manager._id,
      approvedAt: addDaysUTC(new Date(), -9),
    },
    {
      userId: emp6._id,
      leaveType: 'casual',
      startDate: addDaysUTC(new Date(), 2),
      endDate: addDaysUTC(new Date(), 2),
      totalDays: 1,
      reason: 'Home maintenance',
      status: 'rejected',
      approvedBy: manager._id,
      approvedAt: addDaysUTC(new Date(), 1),
    },
    {
      userId: emp7._id,
      leaveType: 'annual',
      startDate: addDaysUTC(new Date(), 30),
      endDate: addDaysUTC(new Date(), 35),
      totalDays: 6,
      reason: 'Travel',
      status: 'pending',
    },
    {
      userId: emp8._id,
      leaveType: 'sick',
      startDate: addDaysUTC(new Date(), -2),
      endDate: addDaysUTC(new Date(), -2),
      totalDays: 1,
      reason: 'Flu',
      status: 'approved',
      approvedBy: manager._id,
      approvedAt: addDaysUTC(new Date(), -1),
    },
    {
      userId: manager._id,
      leaveType: 'casual',
      startDate: addDaysUTC(new Date(), 5),
      endDate: addDaysUTC(new Date(), 5),
      totalDays: 1,
      reason: 'Personal business',
      status: 'pending',
    },
    {
      userId: emp1._id,
      leaveType: 'sick',
      startDate: addDaysUTC(new Date(), -15),
      endDate: addDaysUTC(new Date(), -14),
      totalDays: 2,
      reason: 'Infection',
      status: 'approved',
      approvedBy: admin._id,
      approvedAt: addDaysUTC(new Date(), -13),
    },
  ];

  for (const lData of leavesData) {
    const leave = new Leave(lData);
    await leave.save();
  }

  console.log('✅ Created 10 leave records');

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
    {
      title: 'New Health Insurance Policy',
      content: 'We have updated our health insurance provider. Please review the new benefits in the HR portal.',
      type: 'info',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: 'Monthly Town Hall',
      content: 'The monthly town hall meeting is scheduled for next Wednesday at 3 PM. Agenda: Q1 Progress and Future Goals.',
      type: 'info',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: 'Office Dress Code Update',
      content: 'Starting next month, we are moving to a business casual dress code for all employees.',
      type: 'info',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: 'Password Security Audit',
      content: 'Please ensure your passwords meet the new complexity requirements. Multi-factor authentication is now mandatory.',
      type: 'warning',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: 'Employee Referral Program',
      content: 'Refer a friend and earn a bonus! Check the current openings on our careers page.',
      type: 'info',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: 'Holiday Season Closing',
      content: 'The office will be closed from Dec 24th to Jan 1st for the holiday season.',
      type: 'info',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: [],
    },
    {
      title: 'Critical Bug in Production',
      content: 'A critical bug has been identified in the payment gateway. Teams are working on a fix. Expected downtime: 30 mins.',
      type: 'urgent',
      publishedBy: admin._id,
      isActive: true,
      targetRoles: ['manager', 'admin'],
    },
  ]);

  console.log('✅ Created 10 announcements');

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
      eventType: 'company_event',
      startDate: addDaysUTC(week0, 1), // This Tuesday
      endDate: addDaysUTC(week0, 1),
      color: '#6366f1',
      isPublic: true,
      description: 'All-hands sprint planning for Q1 deliverables',
      createdBy: admin._id,
    },
    {
      title: 'Team Outing',
      eventType: 'company_event',
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
    {
      title: 'Monthly Progress Review',
      eventType: 'company_event',
      startDate: addDaysUTC(new Date(), 5),
      endDate: addDaysUTC(new Date(), 5),
      color: '#3b82f6',
      isPublic: true,
      description: 'Reviewing project milestones for the month',
      createdBy: manager._id,
    },
    {
      title: 'Independence Day',
      eventType: 'holiday',
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-15'),
      color: '#f97316',
      isPublic: true,
      createdBy: admin._id,
    },
    {
      title: 'Company Anniversary',
      eventType: 'company_event',
      startDate: addDaysUTC(new Date(), 45),
      endDate: addDaysUTC(new Date(), 45),
      color: '#ec4899',
      isPublic: true,
      description: 'Celebrating 5 years of excellence',
      createdBy: admin._id,
    },
    {
      title: 'Internal Hackathon',
      eventType: 'company_event',
      startDate: addDaysUTC(new Date(), 60),
      endDate: addDaysUTC(new Date(), 62),
      color: '#8b5cf6',
      isPublic: true,
      description: '48-hour innovation challenge',
      createdBy: manager._id,
    },
    {
      title: 'Gandhi Jayanti',
      eventType: 'holiday',
      startDate: new Date('2026-10-02'),
      endDate: new Date('2026-10-02'),
      color: '#10b981',
      isPublic: true,
      createdBy: admin._id,
    },
    {
      title: 'Year-End Party',
      eventType: 'company_event',
      startDate: new Date('2026-12-23'),
      endDate: new Date('2026-12-23'),
      color: '#ef4444',
      isPublic: true,
      description: 'Celebration of yearly achievements',
      createdBy: admin._id,
    },
  ]);

  console.log('✅ Created 10 calendar events');

  // ── Incidents ──────────────────────────────────────────────────────────────
  console.log('\n🎫 Creating incidents...');

  const incidentsData = [
    { title: 'Login issue', description: 'Unable to login with manager account', category: 'general help', priority: 'High', employee: emp1._id, status: 'Open' },
    { title: 'Project missing', description: 'E-Commerce Revamp not visible in list', category: 'project missing', priority: 'Medium', employee: emp2._id, status: 'In Progress' },
    { title: 'Incorrect hours', description: 'Hours logged as 8 instead of 7.5', category: 'incorrect hours', priority: 'Low', employee: emp3._id, status: 'Resolved' },
    { title: 'Timesheet error', description: 'System hangs on submit', category: 'timesheet error', priority: 'Urgent', employee: emp4._id, status: 'Open' },
    { title: 'Leave conflict', description: 'Overlap with another team member', category: 'leave conflict', priority: 'Medium', employee: emp5._id, status: 'Pending' },
    { title: 'General help', description: 'How to export reports?', category: 'general help', priority: 'Low', employee: emp6._id, status: 'Closed' },
    { title: 'Sync error', description: 'Timesheet not syncing with mobile app', category: 'timesheet error', priority: 'High', employee: emp7._id, status: 'Open' },
    { title: 'Missing task', description: 'QA testing task not in dropdown', category: 'project missing', priority: 'Medium', employee: emp8._id, status: 'In Progress' },
    { title: 'Attachment failed', description: 'Cannot upload proof of work', category: 'general help', priority: 'Low', employee: emp1._id, status: 'Open' },
    { title: 'Notification bug', description: 'Not receiving email for leave approval', category: 'general help', priority: 'Medium', employee: emp2._id, status: 'Open' },
  ];

  for (const iData of incidentsData) {
    const incident = new Incident(iData);
    await incident.save();
  }

  console.log('✅ Created 10 incidents');

  // ── Tasks ──────────────────────────────────────────────────────────────────
  console.log('\n📝 Creating tasks...');

  await Task.insertMany([
    { name: 'Fix Sidebar Navigation', description: 'Resolve the collapse issue', projectId: proj1._id, status: 'in-progress', priority: 'high' },
    { name: 'Update Dashboard Charts', description: 'Use new Recharts version', projectId: proj1._id, status: 'pending', priority: 'medium' },
    { name: 'Implement Auth Middleware', description: 'JWT verification', projectId: proj1._id, status: 'completed', priority: 'urgent' },
    { name: 'Design Landing Page', description: 'Modern aesthetics', projectId: proj2._id, status: 'in-progress', priority: 'high' },
    { name: 'QA Testing - Login', description: 'Verify all edge cases', projectId: proj2._id, status: 'pending', priority: 'medium' },
    { name: 'Database Optimization', description: 'Index popular queries', projectId: proj3._id, status: 'on-hold', priority: 'low' },
    { name: 'API Documentation', description: 'Swagger integration', projectId: proj3._id, status: 'pending', priority: 'medium' },
    { name: 'Mobile Layout Fix', description: 'Tailwind responsive classes', projectId: proj4._id, status: 'in-progress', priority: 'high' },
    { name: 'Unit Tests for Services', description: 'Jest implementation', projectId: proj1._id, status: 'pending', priority: 'medium' },
    { name: 'User Profile UX', description: 'Refine the settings page', projectId: proj1._id, status: 'pending', priority: 'low' },
  ]);

  console.log('✅ Created 10 tasks');

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
