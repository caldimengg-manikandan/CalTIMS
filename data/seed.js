'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Import Models ────────────────────────────────────────────────────────────
const Organization = require('./src/modules/organizations/organization.model');
const User = require('./src/modules/users/user.model');
const Role = require('./src/modules/users/role.model');
const Project = require('./src/modules/projects/project.model');
const Timesheet = require('./src/modules/timesheets/timesheet.model');
const Leave = require('./src/modules/leaves/leave.model');
const Settings = require('./src/modules/settings/settings.model');
const Subscription = require('./src/modules/subscriptions/subscription.model');
const PayrollProfile = require('./src/modules/payroll/payrollProfile.model');
const RoleSalaryStructure = require('./src/modules/payroll/roleSalaryStructure.model');
const ProcessedPayroll = require('./src/modules/payroll/processedPayroll.model');
const AuditLog = require('./src/modules/audit/audit.model');
const { ROLES, TIMESHEET_STATUS, LEAVE_STATUS } = require('./src/constants');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/timesheet_db';

async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected:', MONGO_URI);

  console.log('\n🗑  Clearing existing data...');
  await Promise.all([
    Organization.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
    Project.deleteMany({}),
    Timesheet.deleteMany({}),
    Leave.deleteMany({}),
    Settings.deleteMany({}),
    Subscription.deleteMany({}),
    PayrollProfile.deleteMany({}),
    RoleSalaryStructure.deleteMany({}),
    ProcessedPayroll.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('✅ Collections cleared');

  // ── 0. Create Organization ──────────────────────────────────────────────────
  console.log('\n🏢 Seeding Organization...');
  const org = new Organization({
    name: 'TIMS Payroll Enterprise',
    address: '123 Tech Park, Bangalore, India',
    taxId: 'TAX123456789'
  });
  await org.save();
  const organizationId = org._id;
  console.log('✅ Organization created:', org.name);

  // ── 0.1 Seed Subscription ────────────────────────────────────────────────
  console.log('\n💳 Seeding Pro Subscription...');
  const subscription = new Subscription({
    organizationId,
    planType: 'PRO',
    status: 'ACTIVE',
  });
  await subscription.save();
  console.log('✅ PRO Subscription activated');

  // ── 1. Settings & Compliance ────────────────────────────────────────────────
  console.log('\n⚙️  Seeding Compliance Settings...');
  const settings = new Settings({
    organizationId,
    organization: { companyName: 'TIMS Payroll Enterprise' },
    payroll: {
      currencySymbol: '₹',
      taxRegime: 'OLD',
      standardDeduction: 50000,
      pfWageLimit: 15000,
      pfRate: 12,
      pfEmployerRate: 12,
      esiRate: 0.75,
      esiEmployerRate: 3.25,
      esiLimit: 21000,
      taxToggles: { pf: true, esi: true, tds: true },
      taxSlabs: [
        { min: 0, max: 250000, rate: 0 },
        { min: 250001, max: 500000, rate: 5 },
        { min: 500001, max: 1000000, rate: 20 },
        { min: 1000001, max: 999999999, rate: 30 }
      ]
    }
  });
  await settings.save();
  
  // Link settings back to organization
  org.settings = settings._id;
  await org.save();
  console.log('✅ Compliance settings initialized');

  // ── 1.1 Dynamic Roles ──────────────────────────────────────────────────────
  console.log('\n🔐 Seeding Dynamic Roles & Permissions...');
  const roles = await Role.insertMany([
    {
      organizationId,
      name: 'Admin',
      description: 'Super Admin with full access',
      permissions: { all: { all: ['all'] } },
      isSystemRole: true
    },
    {
      organizationId,
      name: 'HR',
      description: 'Human Resources Manager',
      permissions: {
        users: { all: ['view', 'create', 'edit'] },
        payroll: { all: ['view'] },
        announcements: { all: ['view', 'create', 'edit', 'delete'] }
      },
      isSystemRole: true
    },
    {
      organizationId,
      name: 'Finance',
      description: 'Finance and Payroll Specialist',
      permissions: {
        payroll: { all: ['view', 'create', 'edit', 'approve', 'run'] },
        reporting: { all: ['view', 'export'] }
      },
      isSystemRole: true
    },
    {
      organizationId,
      name: 'Manager',
      description: 'Department Manager',
      permissions: {
        timesheets: { 
          dashboard: ['view'],
          entry: ['view', 'create', 'edit'],
          history: ['view'],
          management: ['view', 'approve', 'reject'] 
        },
        projects: { all: ['view'] },
        tasks: { all: ['view', 'create', 'edit'] }
      },
      isSystemRole: true
    },
    {
      organizationId,
      name: 'Employee',
      description: 'Regular Employee',
      permissions: {
        timesheets: { 
          dashboard: ['view'],
          entry: ['view', 'create', 'edit'],
          history: ['view'] 
        },
        announcements: { all: ['view'] },
        leaves: { 
          'leave tracker': ['view', 'create'],
          'leave requests': ['view'] 
        }
      },
      isSystemRole: true
    }
  ]);

  const roleMap = {};
  roles.forEach(r => { roleMap[r.name.toLowerCase()] = r._id; });
  console.log('✅ 5 Dynamic roles created');


  // ── 2. Salary Structures ───────────────────────────────────────────────────
  console.log('\n🧾 Creating Salary Structures...');
 
  const structures = await RoleSalaryStructure.insertMany([
    {
      organizationId,
      name: 'Software Engineer',
      description: 'Standard Tech Structure',
      type: 'Role-Based',
      earnings: [
        { organizationId, name: 'Basic Salary', value: 40, calculationType: 'Percentage', formula: 'ctc' },
        { organizationId, name: 'House Rent Allowance (HRA)', value: 40, calculationType: 'Percentage', formula: 'basic' },
        { organizationId, name: 'Special Allowance', value: 20, calculationType: 'Percentage', formula: 'ctc' }
      ],
      deductions: [
        { organizationId, name: 'Provident Fund (PF)', value: 12, calculationType: 'Percentage', formula: 'basic' },
        { organizationId, name: 'Professional Tax', value: 200, calculationType: 'Fixed' },
        { organizationId, name: 'Income Tax (TDS)', value: 0, calculationType: 'Fixed' }
      ]
    },
    {
      organizationId,
      name: 'HR Specialist',
      description: 'Administrative Structure',
      type: 'Role-Based',
      earnings: [
        { organizationId, name: 'Basic Salary', value: 50, calculationType: 'Percentage', formula: 'ctc' },
        { organizationId, name: 'HRA', value: 30, calculationType: 'Percentage', formula: 'basic' },
        { organizationId, name: 'Conveyance Allowance', value: 5000, calculationType: 'Fixed' }
      ],
      deductions: [
        { organizationId, name: 'Provident Fund', value: 12, calculationType: 'Percentage', formula: 'basic' },
        { organizationId, name: 'Professional Tax', value: 200, calculationType: 'Fixed' }
      ]
    },
    {
      organizationId,
      name: 'Finance Manager',
      description: 'Management Structure',
      type: 'Role-Based',
      earnings: [
        { organizationId, name: 'Basic Salary', value: 45, calculationType: 'Percentage', formula: 'ctc' },
        { organizationId, name: 'HRA', value: 40, calculationType: 'Percentage', formula: 'basic' },
        { organizationId, name: 'Performance Bonus', value: 10000, calculationType: 'Fixed' }
      ],
      deductions: [
        { organizationId, name: 'Provident Fund', value: 12, calculationType: 'Percentage', formula: 'basic' }
      ]
    }
  ]);
  const [techStruct, hrStruct, finStruct] = structures;
  console.log('✅ 3 Salary structures created');

  // ── 3. Users, Roles & Profiles ──────────────────────────────────────────────
  console.log('\n👤 Seeding 10 Employees & Profiles...');
 
  const pwAdmin = 'Admin@123';
  const pwHR = 'HrManager@123';
  const pwEmp = 'Employee@123';

  const usersData = [
    { name: 'System Admin', email: 'admin@tims.com', password: pwAdmin, role: ROLES.ADMIN, dept: 'Operations', desig: 'Super Admin', isOwner: true },
    { name: 'Jane HR', email: 'hr@tims.com', password: pwHR, role: ROLES.HR, dept: 'HR', desig: 'HR Manager' },
    { name: 'John Dev', email: 'emp1@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'Engineering', desig: 'Senior Developer' },
    { name: 'Sarah Tech', email: 'emp2@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'Engineering', desig: 'Software Engineer' },
    { name: 'Michael Finance', email: 'fin@tims.com', password: pwEmp, role: ROLES.FINANCE, dept: 'Finance', desig: 'Tax Lead' },
    { name: 'Emily Core', email: 'emp3@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'Engineering', desig: 'Backend Developer' },
    { name: 'David Ops', email: 'emp4@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'Operations', desig: 'Ops Lead' },
    { name: 'Chris Dev', email: 'emp5@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'Engineering', desig: 'DevOps' },
    { name: 'Anna HR', email: 'emp6@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'HR', desig: 'Recruiter' },
    { name: 'Robert Finance', email: 'emp7@tims.com', password: pwEmp, role: ROLES.EMPLOYEE, dept: 'Finance', desig: 'Accountant' }
  ];

  const users = [];
  const profiles = [];

  for (let i = 0; i < usersData.length; i++) {
    const d = usersData[i];
    const user = new User({
      organizationId,
      employeeId: `TIMS-${1000 + i}`,
      name: d.name,
      email: d.email,
      password: d.password,
      role: d.role,
      roleId: roleMap[d.role.toLowerCase()] || roleMap.employee,
      department: d.dept,
      designation: d.desig,
      bankName: 'Enterprise Bank',
      accountNumber: `77889900${i}`,
      ifscCode: 'ENTB0001234',
      isActive: true,
      isOnboardingComplete: true,
      isOwner: d.isOwner || false,
      joinDate: new Date('2023-01-01')
    });
    await user.save();
    users.push(user);

    // Create Profile
    const ctc = 600000 + (i * 100000);
    const struct = d.dept === 'Engineering' ? techStruct : (d.dept === 'HR' ? hrStruct : finStruct);
   
    const profile = new PayrollProfile({
      organizationId,
      user: user._id,
      monthlyCTC: Math.round(ctc / 12),
      salaryStructureId: struct._id,
      salaryMode: 'Employee-Based',
      payrollType: 'Monthly',
      isActive: true
    });
    await profile.save();
    profiles.push(profile);
  }
  console.log('✅ 10 Users and Profiles created');

  // ── 4. Project & Timesheets ────────────────────────────────────────────────
  console.log('\n⏱️  Generating Timesheets for March 2026...');
 
  const project = new Project({
    organizationId,
    name: 'Payroll Modernization',
    code: 'PAY-2026',
    description: 'Internal payroll upgrade project',
    startDate: new Date('2026-01-01'),
    status: 'active',
    managerId: users[0]._id
  });
  await project.save();

  const marchWeeks = [
    { start: '2026-03-02', end: '2026-03-08' },
    { start: '2026-03-09', end: '2026-03-15' },
    { start: '2026-03-16', end: '2026-03-22' },
    { start: '2026-03-23', end: '2026-03-29' }
  ];

  for (const user of users) {
    if (user.role === ROLES.ADMIN) continue;

    for (const week of marchWeeks) {
      const ts = new Timesheet({
        organizationId,
        userId: user._id,
        weekStartDate: new Date(week.start),
        weekEndDate: new Date(week.end),
        status: TIMESHEET_STATUS.APPROVED,
        approvedBy: users[0]._id,
        rows: [{
          projectId: project._id,
          category: 'Development',
          entries: [0, 1, 2, 3, 4, 5, 6].map(day => ({
            date: new Date(new Date(week.start).getTime() + day * 24 * 60 * 60 * 1000),
            hoursWorked: day < 5 ? 8 : 0,
            isLeave: false
          }))
        }]
      });
     
      // Simulate LOP for two specific employees in week 2
      if ((user.email === 'emp1@tims.com' || user.email === 'emp2@tims.com') && week.start === '2026-03-09') {
          ts.rows[0].entries[3].isLeave = true;
          ts.rows[0].entries[3].leaveType = 'lop';
          ts.rows[0].entries[3].hoursWorked = 0;
          ts.rows[0].entries[4].isLeave = true;
          ts.rows[0].entries[4].leaveType = 'lop';
          ts.rows[0].entries[4].hoursWorked = 0;
      }
     
      await ts.save();
    }
  }
  console.log('✅ Timesheets for March seeded (with 2 LOP cases)');

  // ── 5. Processed Payroll & Payslips ─────────────────────────────────────────
  console.log('\n💰 Running Payroll Simulation (March 2026)...');

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const profile = profiles[i];
    const ctc = profile.monthlyCTC;
   
    // Simulate manual calculation for high accuracy seed data
    const basic = Math.round(ctc * 0.4);
    const hra = Math.round(basic * 0.4);
    const allowance = ctc - basic - hra;
   
    const isLop = (user.email === 'emp1@tims.com' || user.email === 'emp2@tims.com');
    const lopDays = isLop ? 2 : 0;
    const workingDays = 22;
    const lopDeduction = isLop ? Math.round((basic + hra) / workingDays * lopDays) : 0;
   
    const gross = ctc - lopDeduction;
    const pf = Math.round(Math.min(basic, 15000) * 0.12);
    const pt = 200;
    const tds = gross > 50000 ? Math.round((gross - 50000) * 0.05) : 0; // Simple simulation

    const processed = new ProcessedPayroll({
      organizationId,
      user: user._id,
      month: 3,
      year: 2026,
      paymentType: 'Monthly',
      currencySymbol: '₹',
      status: i < 7 ? 'Completed' : 'Processed', // Simulated Sent vs Generated
      attendance: {
        presents: 22 - lopDays,
        absents: 0,
        leaves: 0,
        lopDays: lopDays,
        workedDays: 22 - lopDays
      },
      breakdown: {
        earnings: {
          components: [
            { name: 'Basic Salary', value: basic },
            { name: 'HRA', value: hra },
            { name: 'Special Allowance', value: allowance }
          ],
          grossEarnings: gross
        },
        deductions: {
          components: [
            { name: 'PF', value: pf },
            { name: 'Professional Tax', value: pt },
            { name: 'TDS', value: tds }
          ],
          totalDeductions: pf + pt + tds + lopDeduction
        },
        netPay: gross - (pf + pt + tds + lopDeduction),
        lopDeduction: lopDeduction,
        executionLog: [
            { component: 'Basic', type: 'Earning', result: basic },
            { component: 'TDS', type: 'Deduction', result: tds }
        ]
      },
      employeeInfo: {
        name: user.name,
        employeeId: user.employeeId,
        department: user.department,
        designation: user.designation,
        branch: 'Head Office'
      },
      bankDetails: {
        bankName: user.bankName,
        accountNumber: user.accountNumber,
        ifscCode: user.ifscCode
      },
      processedAt: new Date()
    });
    await processed.save();
  }
  console.log('✅ Payroll successfully processed for 10 employees');

  console.log('🎉 SEEDING COMPLETE!\n');
  console.log('─────────────────────────────────────────────');
  console.log(' Login Credentials');
  console.log('─────────────────────────────────────────────');
  console.log(' Admin    | admin@tims.com  | Admin@123');
  console.log(' HR       | hr@tims.com     | HrManager@123');
  console.log(' Employee | emp1@tims.com   | Employee@123');
  console.log('─────────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  if (mongoose.connection.readyState !== 0) {
    mongoose.disconnect().then(() => process.exit(1));
  } else {
    process.exit(1);
  }
});