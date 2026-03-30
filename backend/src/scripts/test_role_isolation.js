'use strict';

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { authService } = require('../modules/auth/auth.service');
const Role = require('../modules/users/role.model');
const Organization = require('../modules/organizations/organization.model');
const User = require('../modules/users/user.model');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caltims';

async function testIsolation() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // 1. Cleanup old tests
    await User.deleteMany({ email: /test-role/ });
    await Organization.deleteMany({ name: /Test Org/ });
    await Role.deleteMany({ name: 'Admin', organizationId: { $ne: null } });

    console.log('Creating Organization A...');
    const resultA = await authService.register({
      email: 'admin-a@test-role.com',
      password: 'password123',
      name: 'Admin A',
      organizationName: 'Test Org A',
      phoneNumber: '1234567890',
      ipAddress: '127.0.0.1',
      deviceFingerprint: 'test-fingerprint-a'
    });
    const userA = await User.findOne({ email: 'admin-a@test-role.com' });
    console.log('Org A created. Admin role ID:', userA.roleId);

    console.log('Creating Organization B (should NOT conflict even if it uses "Admin" role)...');
    const resultB = await authService.register({
      email: 'admin-b@test-role.com',
      password: 'password123',
      name: 'Admin B',
      organizationName: 'Test Org B',
      phoneNumber: '0987654321', // Different phone to avoid trial tracking
      ipAddress: '127.0.0.2',
      deviceFingerprint: 'test-fingerprint-b'
    });
    
    const userB = await User.findOne({ email: 'admin-b@test-role.com' });
    console.log('Org B created. Admin role ID:', userB.roleId);

    // Verify
    const roleA = await Role.findById(userA.roleId);
    const roleB = await Role.findById(userB.roleId);

    console.log(`Role A stats: Name="${roleA.name}", OrgId=${roleA.organizationId}`);
    console.log(`Role B stats: Name="${roleB.name}", OrgId=${roleB.organizationId}`);

    if (roleA.name === roleB.name && !roleA.organizationId.equals(roleB.organizationId)) {
      console.log('✅ PASS: Roles have same name but different organization IDs.');
    } else {
      console.log('❌ FAIL: Role isolation check failed.');
    }

  } catch (error) {
    console.error('Test failed:', error.message, error.stack);
    if (error.message.includes('11000')) {
      console.error('❌ FAIL: Duplicate key error still occurring!');
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testIsolation();
