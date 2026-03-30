const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SettingsSchema = new mongoose.Schema({}, { strict: false });
const PayrollPolicySchema = new mongoose.Schema({}, { strict: false });

const Settings = mongoose.model('Settings', SettingsSchema, 'settings');
const PayrollPolicy = mongoose.model('PayrollPolicy', PayrollPolicySchema, 'payrollpolicies');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/caltims');
        console.log('Connected to DB');

        const settings = await Settings.findOne();
        const policies = await PayrollPolicy.find();

        console.log('--- Settings Compliance ---');
        console.log(JSON.stringify(settings?.compliance, null, 2));

        console.log('\n--- All PayrollPolicies ---');
        policies.forEach((p, i) => {
            console.log(`\nPolicy ${i+1} (ID: ${p._id}, Active: ${p.isActive}):`);
            console.log(JSON.stringify(p.compliance, null, 2));
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

check();
