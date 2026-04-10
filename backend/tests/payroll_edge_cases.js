
const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api/v1';

async function setup() {
    try {
        console.log('🚀 Setting up for Edge Case Testing...');
        const orgRes = await axios.post(`${BASE_URL}/auth/register`, {
            organizationName: `EdgeTestOrg_${Date.now()}`,
            name: 'QA Admin',
            email: `qa_admin_${Date.now()}@test.com`,
            password: 'Password123!',
            phoneNumber: (Math.floor(Math.random() * 9000000000) + 1000000000).toString()
        });
        return orgRes.data.data.accessToken;
    } catch (err) {
        console.error('Setup failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

async function createEmployee(token, email, joiningDate) {
    try {
        const res = await axios.post(`${BASE_URL}/users`, {
            name: `Edge User ${email}`,
            email: email,
            password: 'Password123!',
            role: 'employee',
            joiningDate: joiningDate,
            bankName: 'Test Bank',
            accountNumber: '1234567890',
            branchName: 'Main Branch',
            ifscCode: 'TEST0011223',
            uan: '123456789012',
            pan: 'ABCDE1234F',
            aadhaar: '123456789012'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data.data;
    } catch (err) {
        console.error('Employee creation failed:', err.response?.data || err.message);
        return null;
    }
}

async function testCases() {
    const ownerToken = await setup();
    
    const scenarios = [
        { name: 'Standard 31-day month (Jan 2024)', month: 1, year: 2024, days: 31 },
        { name: 'Standard 30-day month (Apr 2024)', month: 4, year: 2024, days: 30 },
        { name: 'Non-Leap Feb (Feb 2023)', month: 2, year: 2023, days: 28 },
        { name: 'Leap Year Feb (Feb 2024)', month: 2, year: 2024, days: 29 },
    ];

    console.log('\n--- 🧪 1. Month Length & Proration Verification ---');
    
    // Create one employee who joined on the 15th
    const midJoiner = await createEmployee(ownerToken, `mid_joiner_${Date.now()}@test.com`, '2024-02-15');
    
    for (const s of scenarios) {
        console.log(`\nTesting scenario: ${s.name}`);
        try {
            // Simulate payroll for this month - POST request with body
            // Controller expects 'employeeId' (the ID from Employee table)
            const simRes = await axios.post(`${BASE_URL}/payroll/process/simulate`, {
                employeeId: midJoiner.employee.id,
                month: s.month,
                year: s.year
            }, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            
            const simulation = simRes.data.data[0];
            if (!simulation || simulation.error) {
                console.error(`  Simulation error: ${simulation?.error || 'No data'}`);
                continue;
            }
            const { attendance, summary, debugInfo } = simulation;
            console.log(`  Debug: ${JSON.stringify(debugInfo)}`);
            console.log(`  Expected days in month: ${s.days}`);
            
            if (s.month === 2 && s.year === 2024) {
                 // Joined Feb 15th. 29 days total. Active 15,16,17...29 = 15 days.
                 // Proration Factor = 15 / 29 = ~0.517
                 // Standard working days (policy default) = 22.
                 // Expected payable days = 22 * (15/29) = ~11.37
                 console.log(`  Payable Days: ${attendance.payableDays.toFixed(2)} (Joined mid-leap-month)`);
                 if (attendance.payableDays > 11 && attendance.payableDays < 12) {
                     console.log('  ✅ Leap year proration correct.');
                 } else {
                     console.error('  ❌ Leap year proration error.');
                 }
            } else if (s.month === 1 && s.year === 2024) {
                 // Joined after Jan (Feb 15). Should have 0 days or error?
                 // Current logic might show full month if joining date wasn't handled strictly.
                 // Actually the logic uses: if (joiningDate > startDate && joiningDate <= endDate)
                 // For Jan, joiningDate (Feb 15) > endDate (Jan 31). So no proration factor applied.
                 // BUT in simulateUserPayroll, it should really check if the user was ACTIVE during that month.
                 console.log(`  Payable Days: ${attendance.payableDays.toFixed(2)} (Before joining date)`);
            }
        } catch (err) {
            console.error(`  Error simulating ${s.name}:`, err.message);
        }
    }

    console.log('\n--- 🧪 2. Negative Salary Prevention ---');
    // Simulate with massive deduction
    // ...
}

testCases();
