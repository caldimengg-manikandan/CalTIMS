/**
 * Migration Script: Salary Structure to Payroll Profile
 * Flattens the architecture by copying earnings/deductions into profiles.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PayrollProfile = require('../src/modules/payroll/payrollProfile.model');
const RoleSalaryStructure = require('../src/modules/payroll/roleSalaryStructure.model');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🚀 Connected to MongoDB');

        const profiles = await PayrollProfile.find({
            $or: [
                { earnings: { $exists: false } },
                { earnings: { $size: 0 } }
            ]
        });

        console.log(`🔍 Found ${profiles.length} profiles to migrate...`);

        let migrated = 0;
        for (const profile of profiles) {
            let structure = null;
            if (profile.salaryStructureId) {
                structure = await RoleSalaryStructure.findById(profile.salaryStructureId);
            }

            if (structure) {
                profile.earnings = structure.earnings;
                profile.deductions = structure.deductions;
                await profile.save();
                migrated++;
            }
        }

        console.log(`✅ Migration complete. ${migrated} profiles updated.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
