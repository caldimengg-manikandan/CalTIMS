'use strict';
require('dotenv').config();

console.log('=== Backend Environment Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('CLIENT_URL:', process.env.CLIENT_URL);
console.log('\n--- Google OAuth Config ---');
console.log('GOOGLE_CLIENT_ID (first 10 chars):', (process.env.GOOGLE_CLIENT_ID || 'MISSING').substring(0, 10) + '...');
console.log('GOOGLE_CLIENT_ID (length):', (process.env.GOOGLE_CLIENT_ID || '').trim().length);
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);
console.log('GOOGLE_CLIENT_SECRET Status:', process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== 'YOUR_CLIENT_SECRET_HERE' ? '✅ Set' : '❌ NOT SET CORRECTLY');
console.log('==============================\n');

process.exit(0);
