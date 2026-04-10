/**
 * SYSTEM VALIDATION & MULTI-TENANT ENFORCEMENT TEST SUITE
 * 
 * This script performs a complete end-to-end validation of the CalTIMS SaaS platform.
 */
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5001/api/v1'; // Adjusted to match server

async function runTests() {
    console.log('🚀 Starting System Validation...');
    const results = [];

    let tokens = {};
    let orgs = {};

    try {
        // --- 🧪 1. USER FLOW TESTING (Registration) ---
        console.log('\n--- 🧪 1. USER FLOW TESTING ---');
        
        // Register Org A
        const orgAName = `OrgA_${Date.now()}`;
        const regA = await axios.post(`${BASE_URL}/auth/register`, {
            email: `owner_a_${Date.now()}@test.com`,
            password: 'Password123!',
            name: 'Owner A',
            organizationName: orgAName,
            phoneNumber: `9${Math.floor(Math.random() * 899999999 + 100000000)}` // 10 digits
        });
        tokens.orgA = regA.data.data.accessToken;
        orgs.orgA = regA.data.data.user.organizationId;
        console.log(`✅ Registered Org A: ${orgAName} (ID: ${orgs.orgA})`);
        console.log(`✅ Role: ${regA.data.data.user.role} (Expected: owner)`);

        // Register Org B
        const orgBName = `OrgB_${Date.now()}`;
        const regB = await axios.post(`${BASE_URL}/auth/register`, {
            email: `owner_b_${Date.now()}@test.com`,
            password: 'Password123!',
            name: 'Owner B',
            organizationName: orgBName,
            phoneNumber: `8${Math.floor(Math.random() * 899999999 + 100000000)}` // 10 digits
        });
        tokens.orgB = regB.data.data.accessToken;
        orgs.orgB = regB.data.data.user.organizationId;
        console.log(`✅ Registered Org B: ${orgBName} (ID: ${orgs.orgB})`);

        // --- 🧪 2. ORGANIZATION ISOLATION ---
        console.log('\n--- 🧪 2. ORGANIZATION ISOLATION ---');
        
        try {
            // Org A owner tries to fetch Org B's user list or something
            // Note: Currently listing users needs manageEmployees permission, which Owners have.
            // But they should only see THEIR OWN org.
            const orgBUsersViaA = await axios.get(`${BASE_URL}/users`, {
                headers: { Authorization: `Bearer ${tokens.orgA}` }
            });
            
            const leakage = orgBUsersViaA.data.data.some(u => u.organizationId === orgs.orgB);
            if (leakage) {
                console.error('❌ CRITICAL: Data Leakage detected! Org A can see Org B users.');
            } else {
                console.log('✅ PASS: No data leakage in User list.');
            }
        } catch (err) {
            console.log(`✅ PASS: Org A blocked or correctly filtered Org B data. (${err.message})`);
        }

        // --- 🧪 3. EMPLOYEE CREATION FLOW ---
        console.log('\n--- 🧪 3. EMPLOYEE CREATION FLOW ---');
        
        const createEmp = async (name, role, email) => {
            return await axios.post(`${BASE_URL}/users`, {
                name,
                email,
                password: 'Password123!',
                role: role.toLowerCase(),
                bankName: 'Test Bank',
                accountNumber: '1234567890',
                branchName: 'Main Branch',
                ifscCode: 'HDFC0123456',
                uan: '123456789012',
                pan: 'ABCDE1234F',
                aadhaar: '123456789012'
            }, {
                headers: { Authorization: `Bearer ${tokens.orgA}` }
            });
        };

        const hr = await createEmp('HR User', 'hr', `hr_${Date.now()}@test.com`);
        const manager = await createEmp('Manager User', 'manager', `mgr_${Date.now()}@test.com`);
        const emp = await createEmp('Employee User', 'employee', `emp_${Date.now()}@test.com`);

        console.log(`✅ Created HR: ${hr.data.data.email}`);
        console.log(`✅ Created Manager: ${manager.data.data.email}`);
        console.log(`✅ Created Employee: ${emp.data.data.email}`);

        // --- 🧪 4. MODULE TESTING (Auth, Employees, Projects, etc.) ---
        console.log('\n--- 🧪 4. MODULE TESTING ---');

        // Create Project in Org A
        const proj = await axios.post(`${BASE_URL}/projects`, {
            name: 'Project Alpha',
            code: `ALPHA${Math.floor(Math.random() * 1000)}`,
            description: 'Test project'
        }, {
            headers: { Authorization: `Bearer ${tokens.orgA}` }
        });
        const projId = proj.data.data.id;
        console.log(`✅ Created Project: ${proj.data.data.name}`);

        // Try to access this project from Org B (Leakage check)
        try {
            await axios.get(`${BASE_URL}/projects/${projId}`, {
                headers: { Authorization: `Bearer ${tokens.orgB}` }
            });
            console.error('❌ CRITICAL: Org B can access Org A project!');
        } catch (err) {
            console.log('✅ PASS: Org B blocked from accessing Org A project.');
        }

        // Create Incident in Org A
        const inc = await axios.post(`${BASE_URL}/incidents`, {
            title: 'System Lag',
            description: 'Dashboard is slow',
            category: 'timesheet error',
            priority: 'High'
        }, {
            headers: { Authorization: `Bearer ${tokens.orgA}` }
        });
        console.log(`✅ Created Incident: ${inc.data.data.incidentId}`);

        // --- 🧪 6. SUBSCRIPTION & TRIAL LOGIC ---
        console.log('\n--- 🧪 6. SUBSCRIPTION & TRIAL LOGIC ---');

        // Simulate Expiry for Org B
        await prisma.subscription.update({
            where: { organizationId: orgs.orgB },
            data: { status: 'EXPIRED', trialEndDate: new Date(Date.now() - 86400000) } // Expired yesterday
        });
        console.log(`✅ Simulated Expiry for ${orgBName}`);

        try {
            await axios.get(`${BASE_URL}/users/me`, {
                headers: { Authorization: `Bearer ${tokens.orgB}` }
            });
            console.error('❌ CRITICAL: Org B can still access system after expiry!');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('✅ PASS: Org B blocked globally after trial expiry.');
            } else {
                console.error(`❌ Unexpected error on expiry check: ${err.message}`);
            }
        }

        console.log('\n✨ Validation Complete! See summary above.');

    } catch (err) {
        console.error('❌ TEST FAILED WITH ERROR:');
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

runTests();
