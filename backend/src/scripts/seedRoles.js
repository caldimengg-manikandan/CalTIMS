'use strict';

const mongoose = require('mongoose');
const Role = require('../modules/users/role.model');
const Settings = require('../modules/settings/settings.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const roles = [
  {
    name: 'Admin',
    isSystem: true,
    templateType: 'Admin',
    description: 'Full system access with master key authority',
    permissions: {
      "Payroll": {
        "Dashboard": ["view"],
        "Payroll Engine": ["view", "run", "submit", "approve", "disburse"],
        "Execution Ledger": ["view"],
        "Payslip Generation": ["view", "generate"],
        "Bank Export": ["view", "export"],
        "Payroll Reports": ["view"]
      },
      "Employees": {
        "Employee List": ["view", "create", "edit", "delete"],
        "Management": ["view", "edit"]
      },
      "Timesheets": {
        "Dashboard": ["view"],
        "Entry": ["view", "create", "edit"],
        "History": ["view"],
        "Management": ["view", "approve", "reject", "lock"]
      },
      "Leave Management": {
        "Leave Tracker": ["view"],
        "Leave Requests": ["view", "create", "approve", "reject"],
        "Leave Policies": ["view", "edit"]
      },
      "My Payslip": {
        "Payslip View": ["view", "download"]
      },
      "Projects": {
        "Project List": ["view", "create", "edit", "delete"]
      },
      "Tasks": {
        "Task Management": ["view", "create", "edit", "delete"]
      },
      "Reports": {
        "Reports Dashboard": ["view", "export"]
      },
      "Announcements": {
        "Announcements": ["view", "create", "edit"]
      },
      "Support": {
        "Help & Support": ["view"]
      },
      "Settings": {
        "General": ["view", "edit"],
        "Users & Roles": ["view", "create", "edit", "delete"],
        "Audit Logs": ["view"]
      }
    }
  },
  {
    name: 'HR',
    isSystem: true,
    templateType: 'HR',
    description: 'Manage employees, leave, and payroll submissions',
    permissions: {
      "Payroll": {
        "Dashboard": ["view"],
        "Payroll Engine": ["view", "run", "submit"],
        "Execution Ledger": ["view"],
        "Payslip Generation": ["view", "generate"],
        "Bank Export": ["view"],
        "Payroll Reports": ["view"]
      },
      "Employees": {
        "Employee List": ["view", "create", "edit"],
        "Management": ["view", "edit"]
      },
      "Leave Management": {
        "Leave Tracker": ["view"],
        "Leave Requests": ["view", "approve", "reject"]
      },
      "Timesheets": {
        "Dashboard": ["view"],
        "Management": ["view", "approve", "reject"]
      }
    }
  },
  {
    name: 'Finance',
    isSystem: true,
    templateType: 'Finance',
    description: 'Approve payroll and manage financial exports',
    permissions: {
      "Payroll": {
        "Dashboard": ["view"],
        "Payroll Engine": ["view", "approve", "disburse"],
        "Execution Ledger": ["view"],
        "Bank Export": ["view", "export"],
        "Payroll Reports": ["view", "export"]
      },
      "Reports": {
        "Reports Dashboard": ["view", "export"]
      }
    }
  },
  {
    name: 'Employee',
    isSystem: true,
    templateType: 'Employee',
    description: 'Self-service access for payslips, leave, and timesheets',
    permissions: {
      "My Payslip": {
        "Payslip View": ["view", "download"]
      },
      "Timesheets": {
        "Entry": ["view", "create", "edit"],
        "History": ["view"]
      },
      "Leave Management": {
        "Leave Tracker": ["view"],
        "Leave Requests": ["view", "create"]
      }
    }
  }
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Update Roles collection
    for (const roleData of roles) {
      await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      console.log(`Role collection updated: ${roleData.name}`);
    }

    // 2. Update Settings singleton
    const settings = await Settings.findOne() || new Settings();
    settings.roles = roles;
    await settings.save();
    console.log('Settings singleton updated with hierarchical roles');

    console.log('Roles seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
}

seedRoles();
