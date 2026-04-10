'use strict';

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function testConcurrency() {
    console.log('≡ƒô┬ Starting Concurrency Stress Test (Employee Creation)...');
    
    // 1. Setup: Register Org
    let ownerToken;
    try {
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            name: 'ConcurrencyOrgOwner',
            email: `concur_${Date.now()}@test.com`,
            password: 'Password123!',
            organizationName: `Concurrency Test ${Date.now()}`,
            phoneNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString()
        });
        ownerToken = regRes.data.data.accessToken;
        console.log('Γ£ö Org Registered.');
    } catch (err) {
        console.error('Γ¥î Registration failed:', err.response?.data || err.message);
        return;
    }

    // 2. Trigger 20 Concurrent Creates (Start smaller than 50 for safety)
    const count = 20;
    console.log(`≡ƒô▓ Triggering ${count} concurrent employee creations...`);
    
    const requests = [...Array(count)].map((_, i) => {
        const uniqueEmail = `user_${i}_${Math.random().toString(36).substring(7)}@test.com`;
        return axios.post(`${BASE_URL}/users`, {
            name: `Concurrent User ${i}`,
            email: uniqueEmail,
            password: 'Password123!',
            role: 'employee',
            bankName: 'Test Bank',
            accountNumber: '1234567890',
            branchName: 'Main Branch',
            ifscCode: 'ICIC0001234',
            uan: '123456789012',
            pan: 'ABCDE1234F',
            aadhaar: '123456789012'
        }, { headers: { Authorization: `Bearer ${ownerToken}` } })
        .catch(err => ({ error: true, data: err.response?.data }));
    });

    const results = await Promise.all(requests);
    
    const successes = results.filter(r => !r.error);
    const failures = results.filter(r => r.error);

    console.log(`\n--- Results ---`);
    console.log(`Total: ${count}`);
    console.log(`Success: ${successes.length}`);
    console.log(`Failures: ${failures.length}`);

    if (failures.length > 0) {
        console.log('First failure:', failures[0].data);
    }

    // 3. Check for Duplicate IDs in DB
    try {
        const listRes = await axios.get(`${BASE_URL}/users?limit=50`, {
            headers: { Authorization: `Bearer ${ownerToken}` }
        });
        const users = listRes.data.data; // Fixed: listRes.data.data is the array of users
        const codes = users.map(u => u.employee?.employeeCode).filter(Boolean);
        const uniqueCodes = new Set(codes);

        console.log(`Unique Codes: ${uniqueCodes.size} / Total Codes: ${codes.length}`);
        
        if (uniqueCodes.size !== codes.length) {
            console.error('Γ¥î CRITICAL FAILURE: Duplicate Employee Codes Detected!');
            
            // Find duplicates
            const seen = new Set();
            const dups = codes.filter(c => seen.has(c) || !seen.add(c));
            console.log('Duplicates:', [...new Set(dups)]);
        } else {
            console.log('Γ£ö PASS: All employee codes are unique.');
        }
    } catch (err) {
        console.error('Γ¥î Failed to verify uniqueness:', err.message);
    }
}

testConcurrency();
