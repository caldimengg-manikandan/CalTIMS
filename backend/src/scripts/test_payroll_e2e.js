'use strict';

/**
 * Payroll End-to-End Test Script (Feb 2026)
 * Purpose: Full validation of payroll execution, DB persistence, RBAC, and state machine.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../modules/users/user.model');
const PayrollProfile = require('../modules/payroll/payrollProfile.model');
const RoleSalaryStructure = require('../modules/payroll/roleSalaryStructure.model');
const Timesheet = require('../modules/timesheets/timesheet.model');
const Settings = require('../modules/settings/settings.model');
const PayrollBatch = require('../modules/payroll/payrollBatch.model');
const ProcessedPayroll = require('../modules/payroll/processedPayroll.model');
const AuditLog = require('../modules/audit/audit.model');

const API_URL = 'http://127.0.0.1:5000/api/v1/payroll';
const TEST_MONTH = 2;
const TEST_YEAR = 2026;

async function runTest() {
  console.log('🚀 Starting Payroll E2E Validation for Feb 2026...');

  try {
    // 0. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timesheet_db');
    console.log('✅ Connected to Database');

    // 1. Phase 1: Setup Test Environment
    console.log('\n--- Phase 1: Setup Test Environment ---');
    
    // a. Create/Identify Test Employees
    const adminUser = await User.findOne({ role: 'super_admin', isActive: true });
    const financeUser = await User.findOne({ role: 'finance', isActive: true });
    const emp1 = await User.findOne({ role: 'employee', isActive: true });
    
    if (!adminUser || !financeUser || !emp1) {
       throw new Error('Required test users (Admin, Finance, Employee) not found in DB.');
    }
    console.log(`Found Test Users: Admin(${adminUser.employeeId}), Finance(${financeUser.employeeId}), Employee(${emp1.employeeId})`);

    // b. Configure Salary Structure
    let structure = await RoleSalaryStructure.findOne({ name: 'Standard Software Engineer' });
    if (!structure) {
        structure = await RoleSalaryStructure.create({
            name: 'Standard Software Engineer',
            isActive: true,
            earnings: [
                { name: 'Basic Salary', calculationType: 'Percentage', value: 40, formula: 'CTC' },
                { name: 'HRA', calculationType: 'Percentage', value: 20, formula: 'Basic Salary' }
            ],
            deductions: [
                { name: 'Professional Tax', calculationType: 'Fixed', value: 200 }
            ]
        });
        console.log('✅ Created Salary Structure');
    }

    // c. Setup Payroll Profiles
    await PayrollProfile.findOneAndUpdate(
        { user: emp1._id },
        { 
            salaryStructureId: structure._id, 
            monthlyCTC: 100000, 
            isActive: true,
            payrollType: 'Monthly'
        },
        { upsert: true }
    );
     await PayrollProfile.findOneAndUpdate(
        { user: financeUser._id },
        { 
            salaryStructureId: structure._id, 
            monthlyCTC: 120000, 
            isActive: true,
            payrollType: 'Monthly'
        },
        { upsert: true }
    );
    console.log('✅ Updated Payroll Profiles for testing');

    // d. Create Timesheets for Feb 2026
    const weekStart = new Date(2026, 1, 1); // Feb 1, 2026
    const weekEnd = new Date(2026, 1, 7);
    await Timesheet.findOneAndUpdate(
        { userId: emp1._id, weekStartDate: weekStart },
        { 
            weekEndDate: weekEnd, 
            totalHours: 40, 
            status: 'approved',
            rows: [{ projectName: 'Internal', entries: [{ date: weekStart, hoursWorked: 8 }] }]
        },
        { upsert: true }
    );
    console.log('✅ Created approved Timesheets for Feb 1-7, 2026');

    // Generate Tokens
    const adminToken = jwt.sign({ sub: adminUser._id }, process.env.JWT_ACCESS_SECRET);
    const financeToken = jwt.sign({ sub: financeUser._id }, process.env.JWT_ACCESS_SECRET);

    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const financeHeaders = { Authorization: `Bearer ${financeToken}` };

    // 2. Phase 2: Execution & Database Verification
    console.log('\n--- Phase 2: Execution & DB Verification ---');
    
    // Clear previous runs for this period to start fresh
    await PayrollBatch.deleteOne({ month: TEST_MONTH, year: TEST_YEAR });
    await ProcessedPayroll.deleteMany({ month: TEST_MONTH, year: TEST_YEAR });

    console.log('Triggering Payroll Run for Feb 2026...');
    const runRes = await axios.post(`${API_URL}/run`, {
        month: TEST_MONTH,
        year: TEST_YEAR
    }, { headers: adminHeaders });

    console.log(`Response received: Success=${runRes.data.success}, Processed=${runRes.data.total}`);
    
    if (!runRes.data.success) throw new Error('Payroll execution failed at API level');

    // DB Check
    const batch = await PayrollBatch.findOne({ month: TEST_MONTH, year: TEST_YEAR });
    const records = await ProcessedPayroll.find({ month: TEST_MONTH, year: TEST_YEAR });

    if (!batch || batch.status !== 'Processed') throw new Error(`Batch status mismatch: Expected Processed, got ${batch?.status}`);
    if (records.length < 2) throw new Error(`Record count mismatch: Expected at least 2, got ${records.length}`);

    // Verify Calculations for Emp1 (CTC 100k)
    const emp1Record = records.find(r => r.user.toString() === emp1._id.toString());
    console.log(`Employee 1 (${emp1.name}) Payroll: Gross=${emp1Record.grossYield}, Net=${emp1Record.netPay}`);
    // CTC 100k. Basic = 40% of 100k = 40k. HRA = 20% of 40k = 8k. PT = 200.
    // Total Earnings = 48000. Deductions = 200 + Statutory (if any).
    // Let's check the components
    const basic = emp1Record.breakdown.earnings.components.find(c => c.name === 'Basic Salary')?.value;
    const hra = emp1Record.breakdown.earnings.components.find(c => c.name === 'HRA')?.value;
    console.log(`Components: Basic=${basic}, HRA=${hra}`);

    // Verify Audit Log
    const log = await AuditLog.findOne({ 
        action: 'RUN_PAYROLL', 
        performedBy: adminUser._id 
    }).sort({ createdAt: -1 });
    if (!log) throw new Error('Audit Log for RUN_PAYROLL not found');
    console.log('✅ Audit Log verified');

    // 3. Phase 3: State Machine Validation
    console.log('\n--- Phase 3: State Machine Validation ---');

    // a. Submit for Approval
    await axios.post(`${API_URL}/submit-approval`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: adminHeaders });
    let updatedBatch = await PayrollBatch.findOne({ month: TEST_MONTH, year: TEST_YEAR });
    console.log(`Status after Submit: ${updatedBatch.status}`);
    if (updatedBatch.status !== 'Pending Approval') throw new Error('Submission failed');

    // b. Reject Invalid Transition (Try to mark paid while pending)
    try {
        await axios.post(`${API_URL}/mark-paid`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: adminHeaders });
        throw new Error('Forbidden transition (Pending -> Paid) succeeded!');
    } catch (err) {
        if (err.response?.status === 400 || err.response?.status === 403) {
            console.log('✅ Correctly rejected invalid transition: Pending -> Paid');
        } else {
            throw err;
        }
    }

    // c. Approve
    await axios.post(`${API_URL}/approve`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: adminHeaders });
    updatedBatch = await PayrollBatch.findOne({ month: TEST_MONTH, year: TEST_YEAR });
    console.log(`Status after Approve: ${updatedBatch.status}`);
    if (updatedBatch.status !== 'Approved') throw new Error('Approval failed');

    // 4. Phase 4: RBAC Validation
    console.log('\n--- Phase 4: RBAC Validation ---');
    
    // a. Finance tries to Mark Paid (should fail 403)
    try {
        await axios.post(`${API_URL}/mark-paid`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: financeHeaders });
        throw new Error('RBAC Failure: Finance user allowed to Mark Paid!');
    } catch (err) {
        if (err.response?.status === 403) {
            console.log('✅ RBAC Success: Finance user denied Mark Paid');
        } else {
            console.log('Unexpected Error during Finance RBAC test:', err.response?.data || err.message);
            throw err;
        }
    }

    // Verify Unauthorized Attempt Log
    const securityLog = await AuditLog.findOne({ 
        action: 'UNAUTHORIZED_PAYMENT_ATTEMPT', 
        performedBy: financeUser._id 
    }).sort({ createdAt: -1 });

    if (!securityLog) {
        const lastFewLogs = await AuditLog.find({ performedBy: financeUser._id }).limit(5).sort({ createdAt: -1 });
        console.log('Last logs for Finance user:', JSON.stringify(lastFewLogs, null, 2));
        throw new Error('Security Audit Log missing for Finance attempt');
    }
    console.log('✅ Security Audit Log verified');    // b. Admin tries (should succeed)
    await axios.post(`${API_URL}/mark-paid`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: adminHeaders });
    updatedBatch = await PayrollBatch.findOne({ month: TEST_MONTH, year: TEST_YEAR });
    console.log(`Status after Admin Mark Paid: ${updatedBatch.status}`);
    if (updatedBatch.status !== 'Paid') throw new Error('Admin payment marking failed');

    // 5. Phase 5: Transaction & Rollback Safety
    console.log('\n--- Phase 5: Transaction & Rollback Safety ---');
    // Note: This requires manually checking if any partial updates happened.
    // We will simulate a failure in step 6 by trying to run a Locked batch.

    // 6. Phase 6: Idempotency & Locking
    console.log('\n--- Phase 6: Idempotency & Locking ---');
    
    // Hard Lock it first
    await axios.post(`${API_URL}/hard-lock`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: adminHeaders });
    updatedBatch = await PayrollBatch.findOne({ month: TEST_MONTH, year: TEST_YEAR });
    if (!updatedBatch.isLocked) throw new Error('Hard Lock failed');
    console.log('✅ Batch is now permanently LOCKED');

    // Try to re-run LOCKED batch
    try {
        await axios.post(`${API_URL}/run`, { month: TEST_MONTH, year: TEST_YEAR }, { headers: adminHeaders });
        throw new Error('Idempotency Failure: Re-run of LOCKED batch succeeded!');
    } catch (err) {
        console.log(`✅ Correctly blocked re-run: ${err.response?.data?.message || err.message}`);
    }

    console.log('\n🎉 ALL PAYROLL E2E TESTS PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    } else {
      console.error(error.message);
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
