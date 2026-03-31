'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config();

const { authService } = require('./src/modules/auth/auth.service');
const User = require('./src/modules/users/user.model');
const Organization = require('./src/modules/organizations/organization.model');

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const testEmail = `test_${Date.now()}@example.com`;
    const testOrg = `Test Org ${Date.now()}`;
    const testPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // Random 10-digit number

    console.log('--- Test 1: Successful Registration ---');
    const result = await authService.register({
      email: testEmail,
      password: 'password123',
      name: 'Test User',
      organizationName: testOrg,
      phoneNumber: testPhone,
      ipAddress: '127.0.0.1',
      deviceFingerprint: 'test-device'
    });
    console.log('Registration successful:', result.user.email);

    console.log('--- Test 2: Duplicate Organization Name (Fail Fast) ---');
    try {
      await authService.register({
        email: `another_${Date.now()}@example.com`,
        password: 'password123',
        name: 'Another User',
        organizationName: testOrg, // Duplicate
        phoneNumber: '0987654321',
        ipAddress: '127.0.0.1',
        deviceFingerprint: 'test-device'
      });
      console.error('Test 2 FAILED: Should have thrown duplicate error');
    } catch (err) {
      console.log('Test 2 PASSED: Caught expected error:', err.message);
    }

    console.log('--- Test 3: Duplicate Email (Fail Fast) ---');
    try {
      await authService.register({
        email: testEmail, // Duplicate
        password: 'password123',
        name: 'Duplicate Email User',
        organizationName: `New Org ${Date.now()}`,
        phoneNumber: '1122334455',
        ipAddress: '127.0.0.1',
        deviceFingerprint: 'test-device'
      });
      console.error('Test 3 FAILED: Should have thrown duplicate error');
    } catch (err) {
      console.log('Test 3 PASSED: Caught expected error:', err.message);
    }

    // Cleanup
    console.log('Cleaning up test data...');
    await User.deleteOne({ email: testEmail });
    await Organization.deleteOne({ name: testOrg });
    console.log('Cleanup complete');

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
