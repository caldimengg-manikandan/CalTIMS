const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

async function checkSettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/timesheet_db');
        const Settings = mongoose.model('Settings', new mongoose.Schema({
            hardwareGateways: Object,
            integrations: Object
        }, { strict: false }));
        
        const allSettings = await Settings.find();
        console.log(`Found ${allSettings.length} settings documents.`);
        allSettings.forEach((s, i) => {
            console.log(`\nDocument ${i + 1}:`);
            console.log(`ID: ${s._id}`);
            console.log('Hardware Gateways:', JSON.stringify(s.hardwareGateways, null, 2));
        });
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkSettings();
