const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SettingsSchema = new mongoose.Schema({}, { strict: false });
const PayrollPolicySchema = new mongoose.Schema({}, { strict: false });

const Settings = mongoose.model('Settings', SettingsSchema, 'settings');
const PayrollPolicy = mongoose.model('PayrollPolicy', PayrollPolicySchema, 'payrollpolicies');

async function fix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/caltims');
        console.log('Connected to DB');

        const settings = await Settings.findOne();
        if (!settings) {
            console.log('No settings found. Skipping.');
            process.exit(0);
        }

        console.log('Syncing all Active Policies...');
        
        // Map attendance settings if they exist in Settings (legacy)
        const legacyAttendance = {
            workingHoursPerDay: settings.general?.workingHoursPerDay,
            weekStartDay: settings.general?.weekStartDay,
        };

        const result = await PayrollPolicy.updateMany(
            { isActive: true },
            { 
                $set: { 
                    compliance: settings.compliance,
                    attendance: legacyAttendance 
                } 
            }
        );

        console.log(`--- Sync Completed ---`);
        console.log(`Updated ${result.modifiedCount} policies.`);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

fix();
