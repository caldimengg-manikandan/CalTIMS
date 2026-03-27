'use strict';

const { hasPermission } = require('../middleware/permission.middleware');

// Mock Request and Response
const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const mockNext = () => {
  const next = (err) => {
    next.called = true;
    next.error = err;
  };
  next.called = false;
  return next;
};

// Test Cases
const testRoles = {
  admin: {
    role: 'admin',
    permissions: {} // Admin bypasses checks
  },
  hr: {
    role: 'hr',
    permissions: {
      'Payroll': {
        'Payroll Engine': ['view', 'run']
      }
    }
  },
  finance: {
    role: 'finance',
    permissions: {
      'Payroll': {
        'Payroll Engine': ['view', 'approve']
      }
    }
  }
};

async function runTests() {
  console.log('--- Running RBAC Validation Tests ---');

  // Test 1: Admin bypass
  {
    const req = { user: testRoles.admin };
    const res = mockRes();
    const next = mockNext();
    await hasPermission('Payroll', 'Payroll Engine', 'approve')(req, res, next);
    console.log('Test 1 (Admin Bypass):', next.called ? 'PASSED' : 'FAILED');
  }

  // Test 2: HR has 'run' but not 'approve'
  {
    const req = { user: testRoles.hr };
    const res = mockRes();
    const next = mockNext();
    await hasPermission('Payroll', 'Payroll Engine', 'run')(req, res, next);
    console.log('Test 2.1 (HR Run - Allowed):', next.called ? 'PASSED' : 'FAILED');

    const next2 = mockNext();
    await hasPermission('Payroll', 'Payroll Engine', 'approve')(req, res, next2);
    console.log('Test 2.2 (HR Approve - Forbidden):', (!next2.called && res.statusCode === 403) ? 'PASSED' : 'FAILED');
  }

  // Test 3: Finance has 'approve' but not 'run'
  {
    const req = { user: testRoles.finance };
    const res = mockRes();
    const next = mockNext();
    await hasPermission('Payroll', 'Payroll Engine', 'approve')(req, res, next);
    console.log('Test 3.1 (Finance Approve - Allowed):', next.called ? 'PASSED' : 'FAILED');

    const next2 = mockNext();
    await hasPermission('Payroll', 'Payroll Engine', 'run')(req, res, next2);
    console.log('Test 3.2 (Finance Run - Forbidden):', (!next2.called && res.statusCode === 403) ? 'PASSED' : 'FAILED');
  }

  // Test 4: Module-only check
  {
    const req = { user: testRoles.hr };
    const res = mockRes();
    const next = mockNext();
    await hasPermission('Payroll')(req, res, next);
    console.log('Test 4 (Module Check):', next.called ? 'PASSED' : 'FAILED');
    
    const next2 = mockNext();
    await hasPermission('NonExistent')(req, res, next2);
    console.log('Test 5 (Non-existent Module):', (!next2.called && res.statusCode === 403) ? 'PASSED' : 'FAILED');
  }

  console.log('--- Tests Completed ---');
}

// Minimal mock for Role model to avoid DB dependency in this script if possible, 
// but since hasPermission requires Role.findById if permissions are missing, 
// I'll ensure the mock user has permissions already attached.
runTests();
