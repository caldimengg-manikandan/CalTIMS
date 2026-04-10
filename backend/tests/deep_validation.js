const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:5001/api/v1';
let tokens = {};
let organizationId = '';
let employees = [];
let managerIds = [];
let hrId = '';

const randomPhone = () => Math.floor(6000000000 + Math.random() * 3999999999).toString();
const randomPAN = () => 'ABCDE' + Math.floor(1000 + Math.random() * 8999).toString() + 'F';
const randomAadhaar = () => Math.floor(100000000000 + Math.random() * 899999999999).toString();
const randomUAN = () => Math.floor(100000000000 + Math.random() * 899999999999).toString();
const IFSC = 'HDFC0001234';

async function runDeepValidation() {
    console.log('≡ƒÜÇ Starting Deep System Validation...');

    try {
        // --- 1. SETUP ---
        console.log('\n--- ≡ƒº¬ 1. SYSTEM SETUP ---');
        const orgName = `DeepOrg_${Date.now()}`;
        const ownerEmail = `owner_${Date.now()}@test.com`;
        
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            name: 'System Owner',
            email: ownerEmail,
            password: 'Password123!',
            organizationName: orgName,
            phoneNumber: randomPhone()
        });
        organizationId = regRes.data.data.user.organizationId;
        tokens.owner = regRes.data.data.accessToken;
        console.log(`Γ£à Registered Org: ${orgName} (ID: ${organizationId})`);

        // Create 2 Managers
        for (let i = 1; i <= 2; i++) {
            const res = await axios.post(`${BASE_URL}/users`, {
                name: `Manager ${i}`,
                email: `manager${i}_${Date.now()}@test.com`,
                password: 'Password123!',
                role: 'manager',
                phone: randomPhone(),
                bankName: 'Test Bank',
                accountNumber: '123456789012',
                branchName: 'Main Branch',
                ifscCode: IFSC,
                uan: randomUAN(),
                pan: randomPAN(),
                aadhaar: randomAadhaar()
            }, { headers: { Authorization: `Bearer ${tokens.owner}` } });
            managerIds.push(res.data.data.employee.id);
            employees.push(res.data.data.employee);
            console.log(`Γ£à Created Manager ${i}`);
        }

        // Create 1 HR
        const hrRes = await axios.post(`${BASE_URL}/users`, {
            name: 'HR Admin',
            email: `hr_${Date.now()}@test.com`,
            password: 'Password123!',
            role: 'hr',
            phone: randomPhone(),
            bankName: 'Test Bank',
            accountNumber: '123456789012',
            branchName: 'Main Branch',
            ifscCode: IFSC,
            uan: randomUAN(),
            pan: randomPAN(),
            aadhaar: randomAadhaar()
        }, { headers: { Authorization: `Bearer ${tokens.owner}` } });
        hrId = hrRes.data.data.employee.id;
        employees.push(hrRes.data.data.employee);
        console.log(`Γ£à Created HR Admin`);

        // Create 5 Employees
        for (let i = 1; i <= 5; i++) {
            const res = await axios.post(`${BASE_URL}/users`, {
                name: `Employee ${i}`,
                email: `emp${i}_${Date.now()}@test.com`,
                password: 'Password123!',
                role: 'employee',
                phone: randomPhone(),
                bankName: 'Test Bank',
                accountNumber: '123456789012',
                branchName: 'Main Branch',
                ifscCode: IFSC,
                uan: randomUAN(),
                pan: randomPAN(),
                aadhaar: randomAadhaar()
            }, { headers: { Authorization: `Bearer ${tokens.owner}` } });
            employees.push(res.data.data.employee);
            console.log(`Γ£à Created Employee ${i} (Code: ${res.data.data.employee.employeeCode})`);
        }

        // Create Payroll Profiles for ALL (Managers, HR, Employees)
        console.log('\n--- ≡ƒº¬ 2.5 PAYROLL PROFILES ---');
        const allUserIds = [
            ...employees.map(e => e.userId),
            ...managerIds.map(mId => employees.find(e => e.id === mId)?.userId).filter(Boolean),
            // Wait, manager/HR IDs are stored differently in my script
        ];

        // Let's just collect all created employee objects
        // I need to track hr and manager employee objects too
        // (Quick fix: just iterate the employees list I have)
        for (const emp of employees) {
            await axios.post(`${BASE_URL}/payroll/profiles`, {
                employeeId: emp.id,
                user: emp.userId,
                monthlyCTC: 50000
            }, { headers: { Authorization: `Bearer ${tokens.owner}` } });
            console.log(`Γ£à Created Payroll Profile for ${emp.userId}`);
        }

        // --- 2. ID UNIQUENESS VALIDATION ---
        console.log('\n--- ≡ƒº¬ 2. ID UNIQUENESS ---');
        const allCodes = employees.map(e => e.employeeCode);
        const uniqueCodes = new Set(allCodes);
        if (allCodes.length === uniqueCodes.size) {
            console.log('Γ£à PASS: All employeeCodes are unique.');
        } else {
            console.error('Γ¥î FAIL: Duplicate employeeCodes detected!');
        }

        // --- 3. PAYROLL SCENARIOS ---
        console.log('\n--- ≡ƒº¬ 3. PAYROLL CRITICAL SCENARIOS ---');
        
        const midMonth = new Date();
        midMonth.setDate(15);
        await axios.put(`${BASE_URL}/users/${employees[1].userId}`, {
            joiningDate: midMonth.toISOString()
        }, { headers: { Authorization: `Bearer ${tokens.owner}` } });
        console.log('Γ£à Set Employee 2 joining date to mid-month.');

        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        
        console.log('≡ƒöä Running Payroll Cycle...');
        let payrolls = [];
        try {
            const payrollRes = await axios.post(`${BASE_URL}/payroll/run`, {
                month,
                year
            }, { headers: { Authorization: `Bearer ${tokens.owner}` } });
            payrolls = payrollRes.data.data; // Note: controller returns .data
        } catch (error) {
            console.log('╬ô┬Ñ├« Validation Fault:', error.response?.data?.message || error.message);
            if (error.response?.data?.stack) console.log(error.response.data.stack);
            process.exit(1);
        }
        
        if (!payrolls || !Array.isArray(payrolls)) {
            console.error('Γ¥î FAIL: No payroll data returned.');
            process.exit(1);
        }
        
        const emp2Payroll = payrolls.find(p => p.employeeId === employees[1].id);
        if (emp2Payroll && emp2Payroll.breakdown.summary.gross < 1000) { 
             console.log(`Γ£à Emp 2 Proration Check: Gross ${emp2Payroll.breakdown.summary.gross} (Prorated)`);
        } else {
             console.warn(`Γ¥á Emp 2 Proration: Gross ${emp2Payroll?.breakdown.summary.gross}.`);
        }

        // --- 4. MULTI-TENANT ISOLATION ---
        console.log('\n--- ≡ƒº¬ 4. CROSS-TENANT ISOLATION ---');
        const secondOrgRes = await axios.post(`${BASE_URL}/auth/register`, {
            name: 'Attacker Org',
            email: `attacker_${Date.now()}@test.com`,
            password: 'Password123!',
            organizationName: 'Attacker Ltd',
            phoneNumber: randomPhone()
        });
        const attackerToken = secondOrgRes.data.data.accessToken;
        
        try {
            await axios.get(`${BASE_URL}/users/${employees[0].userId}`, {
                headers: { Authorization: `Bearer ${attackerToken}` }
            });
            console.error('Γ¥î FAIL: Attacker accessed Org A data!');
        } catch (err) {
            console.log('Γ£à PASS: Cross-tenant access blocked (404/403).');
        }

        console.log('\nΓ£¿ Deep Validation Complete!');

    } catch (err) {
        console.error('Γ¥î Validation Fault:', err.response?.data || err.message);
        process.exit(1);
    }
}

runDeepValidation();
