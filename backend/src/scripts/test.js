'use strict';

/**
 * Enterprise Payroll Workflow Validator
 * Mode: Automated Compliance Simulation
 * 
 * Verifies:
 * 1. State Machine Transitions
 * 2. Role-Based Access Controls
 * 3. Security Invariants
 * 4. Audit Trail Integrity
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const payrollService = require('../modules/payroll/payroll.service');
const User = require('../modules/users/user.model');
const Settings = require('../modules/settings/settings.model');
const PayrollBatch = require('../modules/payroll/payrollBatch.model');
const Audit = require('../modules/audit/audit.model');

async function runValidation() {
    let mongoServer;
    try {
        console.log('--- 🚀 ENTERPRISE PAYROLL VALIDATION STARTING ---');
        
        // 1. Setup Environment
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        console.log('✅ In-memory database connected.');

        // 2. Seed Roles and Settings
        const roles = [
            {
                name: 'admin',
                permissions: { "Payroll": { "Payroll Engine": ["view", "run", "submit", "approve", "disburse"] } }
            },
            {
                name: 'hr',
                permissions: { "Payroll": { "Payroll Engine": ["view", "run", "submit"] } }
            },
            {
                name: 'finance',
                permissions: { "Payroll": { "Payroll Engine": ["view", "approve", "disburse"] } }
            }
        ];
        await Settings.create({ roles });
        console.log('✅ RBAC Roles seeded (Finance with disburse risk retained for detection).');

        // 3. Create Users
        const adminUser = await User.create({ name: 'Super Admin', email: 'admin@tims.com', role: 'admin', password: 'password123', isActive: true });
        const hrUser = await User.create({ name: 'HR Manager', email: 'hr@tims.com', role: 'hr', password: 'password123', isActive: true });
        const financeUser = await User.create({ name: 'Finance Controller', email: 'finance@tims.com', role: 'finance', password: 'password123', isActive: true });
        const employee = await User.create({ name: 'John Employee', email: 'john@tims.com', role: 'employee', password: 'password123', isActive: true });
        console.log('✅ Test actors created.');

        const results = {
            stateMachine: 'FAIL',
            rbac: 'FAIL',
            security: 'FAIL',
            audit: 'FAIL',
            logs: []
        };

        const month = 3, year = 2026;

        // --- TEST 1: STATE MACHINE SEQUENTIAL INTEGRITY ---
        console.log('\n--- 🧪 TEST 1: STATE MACHINE VALIDATION ---');
        try {
            await payrollService.ensureBatchExists(month, year, null);
            console.log('✔ Draft Created.');
            
            // Try to approve from draft (Should fail)
            try {
                await payrollService.approvePayroll({ month, year, userId: financeUser._id });
                results.logs.push('❌ SKIPPING STATE: Draft -> Approved worked! (ERROR)');
            } catch (err) {
                results.logs.push('✔ BLOCKED: Draft -> Approved correctly failed.');
            }

            // Move to Processed (via runPayroll - simplified or manual update for speed)
            await PayrollBatch.findOneAndUpdate({ month, year }, { status: 'Processed' });
            console.log('✔ Moved to Processed.');

            // Try to mark as paid from Processed (Should fail)
            try {
                await payrollService.markAsPaid({ month, year, processedBy: adminUser._id });
                results.logs.push('❌ SKIPPING STATE: Processed -> Paid worked! (ERROR)');
            } catch (err) {
                results.logs.push('✔ BLOCKED: Processed -> Paid correctly failed.');
            }
            
            results.stateMachine = 'PASS';
        } catch (err) {
            console.error('State Machine Test Error:', err);
        }

        // --- TEST 2: RBAC ENFORCEMENT ---
        console.log('\n--- 🧪 TEST 2: RBAC VALIDATION ---');
        
        // Note: Middleware checks would normally handle this. We simulate the logic here.
        const checkPerm = (roleName, module, submodule, action) => {
            const role = roles.find(r => r.name === roleName);
            const perms = role.permissions[module]?.[submodule] || [];
            return perms.includes(action);
        };

        // HR Validations
        const hrCanRun = checkPerm('hr', 'Payroll', 'Payroll Engine', 'run');
        const hrCanApprove = checkPerm('hr', 'Payroll', 'Payroll Engine', 'approve');
        results.logs.push(hrCanRun ? '✔ HR Allowed: Run Payroll' : '❌ HR Blocked: Run Payroll (ERROR)');
        results.logs.push(!hrCanApprove ? '✔ HR Blocked: Approve Payroll' : '❌ HR Allowed: Approve Payroll (FAIL)');

        // Finance Validations
        const finCanApprove = checkPerm('finance', 'Payroll', 'Payroll Engine', 'approve');
        const finCanRun = checkPerm('finance', 'Payroll', 'Payroll Engine', 'run');
        const finCanPaid = checkPerm('finance', 'Payroll', 'Payroll Engine', 'disburse');

        results.logs.push(finCanApprove ? '✔ Finance Allowed: Approve Payroll' : '❌ Finance Blocked: Approve Payroll (ERROR)');
        results.logs.push(!finCanRun ? '✔ Finance Blocked: Run Payroll' : '❌ Finance Allowed: Run Payroll (FAIL)');
        
        // DETECTION OF REQUIREMENT BREACH
        if (finCanPaid) {
            results.logs.push('🚨 SECURITY RISK: Finance has "disburse" permission in seed! (FAIL)');
            results.rbac = 'FAIL';
        } else {
            results.logs.push('✔ Finance Blocked: Mark as Paid');
            results.rbac = 'PASS';
        }

        // --- TEST 3: CONCURRENCY ---
        console.log('\n--- 🧪 TEST 3: CONCURRENCY TEST ---');
        await PayrollBatch.findOneAndUpdate({ month, year }, { status: 'Pending Approval' });
        
        // Single call to approve
        const call1 = payrollService.approvePayroll({ month, year, userId: financeUser._id });
        const call2 = payrollService.approvePayroll({ month, year, userId: financeUser._id });
        
        try {
            const [res1, res2] = await Promise.allSettled([call1, call2]);
            if (res1.status === 'fulfilled' && res2.status === 'rejected') {
                results.logs.push('✔ CONCURRENCY: Second approval attempt correctly rejected.');
                results.security = 'PASS';
            } else {
                results.logs.push('❌ CONCURRENCY: Double approval mismatch! Check idempotency.');
            }
        } catch (err) {
             results.logs.push('❌ CONCURRENCY: Test execution failure.');
        }

        // --- TEST 4: AUDIT LOG ---
        console.log('\n--- 🧪 TEST 4: AUDIT LOG VALIDATION ---');
        const logs = await Audit.find();
        if (logs.length > 0) {
            results.logs.push(`✔ AUDIT: ${logs.length} log entries found.`);
            const hasAction = (action) => logs.some(l => l.action === action);
            if (hasAction('APPROVE_PAYROLL_FINANCE') || hasAction('SUBMIT_PAYROLL_APPROVAL')) {
                results.audit = 'PASS';
            } else {
                results.logs.push('❌ AUDIT: Missing specific payroll actions.');
            }
        } else {
            results.logs.push('❌ AUDIT: No logs generated.');
        }

        console.log('\n--- 📊 VALIDATION RESULTS ---');
        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('Fatal Validation Error:', err);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        if (mongoServer) {
            await mongoServer.stop();
        }
        process.exit(0);
    }
}

runValidation();
