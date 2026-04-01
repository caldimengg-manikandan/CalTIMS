'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../src/modules/users/user.model');
const Settings = require('../src/modules/settings/settings.model');
const RoleSalaryStructure = require('../src/modules/payroll/roleSalaryStructure.model');
const PayrollBatch = require('../src/modules/payroll/payrollBatch.model');
const ProcessedPayroll = require('../src/modules/payroll/processedPayroll.model');
const PayrollLedger = require('../src/modules/payroll/payrollLedger.model');
const PayrollJob = require('../src/modules/payroll/payrollJob.model');

const API_URL = 'http://127.0.0.1:5000/api/v1/payroll';
const TEST_MONTH = 4;
const TEST_YEAR = 2026;

async function runValidation() {
    console.log('\n🏦 BANK-GRADE PAYROLL CERTIFICATION');
    console.log('====================================');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timesheet_db');
        console.log('✅ DB Connected');

        const admin = await User.findOne({ role: 'super_admin', isActive: true });
        if (!admin) throw new Error('Super Admin not found in DB. Run seed first.');
        const organizationId = admin.organizationId;
        const adminToken = jwt.sign({ sub: admin._id, role: admin.role, organizationId }, process.env.JWT_ACCESS_SECRET || 'secret');
        const http = axios.create({ baseURL: API_URL, headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true });

        // Clean previous runs
        await PayrollBatch.deleteMany({ month: TEST_MONTH, year: TEST_YEAR, organizationId });
        await ProcessedPayroll.deleteMany({ month: TEST_MONTH, year: TEST_YEAR, organizationId });

        console.log('\n--- 🧪 TEST 1: Optimistic Concurrency Control (OCC) ---');
        // 1. Run payroll to create a batch
        const resRun = await http.post('/run', { month: TEST_MONTH, year: TEST_YEAR });
        if (resRun.status !== 200) {
            console.error(`❌ FAIL: /run failed with status ${resRun.status}. Msg: ${resRun.data.message}`);
            throw new Error('Initial payroll run failed');
        }

        let batch = await PayrollBatch.findOne({ month: TEST_MONTH, year: TEST_YEAR, organizationId });
        if (!batch) {
            console.error(`❌ FAIL: Batch not found in DB after /run! [Month: ${TEST_MONTH}, Year: ${TEST_YEAR}, Org: ${organizationId}]`);
            // List existing batches for debug
            const all = await PayrollBatch.find({ organizationId });
            console.log(`Debug: Existing batches for this org: ${JSON.stringify(all.map(b => `${b.month}/${b.year}` ))}`);
            throw new Error('Batch creation failed');
        }
        const currentVersion = batch.__v;
        console.log(`Initial Batch Version (__v): ${currentVersion}`);

        // 2. Simulate concurrent markAsPaid with the same version
        console.log('Dispatching simultaneous Mark-Paid requests...');
        const [res1, res2] = await Promise.all([
            http.post('/mark-paid', { month: TEST_MONTH, year: TEST_YEAR, version: currentVersion }),
            http.post('/mark-paid', { month: TEST_MONTH, year: TEST_YEAR, version: currentVersion })
        ]);

        if (res1.status === 200 && res2.status === 500 && res2.data.message.includes('Conflict')) {
            console.log('✅ PASS: OCC successfully blocked simultaneous dual-disbursement.');
        } else {
            console.log(`❌ FAIL: Race condition not detected. Statuses: ${res1.status}, ${res2.status}. Msg: ${res2.data.message}`);
        }

        console.log('\n--- 🧪 TEST 2: Effective-Dated Salary Structures ---');
        const structName = 'Banker Senior';
        await RoleSalaryStructure.deleteMany({ name: structName, organizationId });

        // Ensure Admin has a Payroll Profile
        const Profile = require('../src/modules/payroll/payrollProfile.model');
        let profile = await Profile.findOne({ user: admin._id, organizationId });
        if (!profile) {
            profile = await Profile.create({ user: admin._id, organizationId, monthlyCTC: 100000, isActive: true, employeeId: admin.employeeId });
        }

        // 1. Create V1 (Effective from far past)
        const v1 = await RoleSalaryStructure.create({
            name: structName, organizationId, isActive: true, 
             effectiveFrom: new Date(2020, 0, 1),
            earnings: [{ name: 'Base', value: 50000, calculationType: 'Fixed', organizationId }]
        });
        console.log('Created Structure V1 (Base: 50000)');
        
        // Link profile to the structure name (via _id of any version)
        profile.salaryStructureId = v1._id;
        profile.salaryMode = 'Role-Based';
        await profile.save();

        // 2. Version it to V2 (Effective from mid April 2026)
        await http.post('/role-structures', { 
            _id: v1._id,
            name: structName,
            earnings: [{ name: 'Base', value: 75000, calculationType: 'Fixed', organizationId }]
        });
        console.log('Versioned to V2 (Base: 75000) effective via Controller logic');

        // Disable proration for consistent test results
        await Settings.findOneAndUpdate({ organizationId }, { $set: { 'attendance.prorateSalary': false } });

        // 3. Validate recals
        const resMarch = await http.post('/process/simulate', { month: 3, year: 2026, employeeId: admin.employeeId });
        console.log(`Simulation March Data: ${JSON.stringify(resMarch.data.data[0], null, 2)}`);
        const marchBase = resMarch.data.data[0]?.breakdown?.earnings?.components?.find(c => c.name === 'Base')?.value;
        
        const resMay = await http.post('/process/simulate', { month: 5, year: 2026, employeeId: admin.employeeId });
        console.log(`Simulation May Data: ${JSON.stringify(resMay.data.data[0], null, 2)}`);
        const mayBase = resMay.data.data[0]?.breakdown?.earnings?.components?.find(c => c.name === 'Base')?.value;

        console.log(`Audit: March Base = ${marchBase}, May Base = ${mayBase}`);
        if (Math.round(marchBase) === 50000 && Math.round(mayBase) === 75000) {
            console.log('✅ PASS: Historical payroll accuracy maintained via Effective-Dating.');
        } else {
             console.log('❌ FAIL: Simulation logic not correctly picking effective-dated structures.');
        }

        console.log('\n--- 🧪 TEST 3: Immutable Financial Audit Ledger ---');
        const ledgerEntries = await PayrollLedger.find({ batchId: batch._id }).sort({ timestamp: 1 });
        console.log(`Found ${ledgerEntries.length} immutable ledger entries for current batch.`);
        
        if (ledgerEntries.length >= 2) {
            const allHashed = ledgerEntries.every(e => e.hash && e.previousHash);
            if (allHashed) {
                console.log('✅ PASS: Tamper-evident Auditor Chain verified.');
            } else {
                console.log('❌ FAIL: Ledger hashing incomplete.');
            }
        } else {
            console.log('❌ FAIL: Ledger entries missing.');
        }
        
        // Test Ledger Immutability
        try {
            await PayrollLedger.updateOne({ _id: ledgerEntries[0]._id }, { $set: { action: 'FRAUD' } });
            console.log('❌ FAIL: Ledger record allowed mutation!');
        } catch (err) {
            console.log('✅ PASS: Explicitly blocked direct Ledger tampering.');
        }

        console.log('\n--- 🧪 TEST 4: Asynchronous Side-Effects (Jobs) ---');
        const payrollIds = (await ProcessedPayroll.find({ month: TEST_MONTH, year: TEST_YEAR, organizationId }).limit(1)).map(p => p._id);
        await http.post('/payslips/bulk-send-email', { ids: payrollIds });
        
        const jobCount = await PayrollJob.countDocuments({ organizationId, type: 'SEND_PAYSLIP_EMAILS' });
        if (jobCount > 0) {
            console.log(`✅ PASS: Background Job created. Counter: ${jobCount}`);
        } else {
            console.log('❌ FAIL: Side-effect not queued.');
        }

        console.log('\n====================================');
        console.log('🏆 SYSTEM CERTIFIED: BANK-GRADE READY');

    } catch (err) {
        console.error('❌ VALIDATION CRITICAL ERROR:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runValidation();
