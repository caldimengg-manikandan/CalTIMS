'use strict';
const path = require('path');
// Attempt to load from multiple locations
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const runDiag = async () => {
    console.log('=== Backend Environment Check ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);
    console.log('CLIENT_URL:', process.env.CLIENT_URL);

    console.log('\n--- SMTP Config ---');
    console.log('SMTP_HOST:', process.env.SMTP_HOST || 'MISSING');
    console.log('SMTP_USER:', process.env.SMTP_USER || 'MISSING');
    console.log('SMTP_PASS Status:', process.env.SMTP_PASS ? '✅ Set' : '❌ MISSING');

    console.log('\n--- PDF Dependencies ---');
    try {
        const puppeteer = require('puppeteer');
        console.log('Puppeteer package: ✅ Installed');
        console.log('Testing Browser Launch...');
        const browser = await puppeteer.launch({ 
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        console.log('Browser Launch: ✅ SUCCESS');
        await browser.close();
    } catch (e) {
        console.log('Puppeteer/Browser Error: ❌ FAILED');
        console.log('Error Details:', e.message);
    }
    console.log('==============================\n');
    process.exit(0);
};

runDiag();
