'use strict';

/**
 * Migration Script: Fix Finance Role Permissions
 * Removes "disburse" from the Finance role in both the Role collection and Settings.
 */

const mongoose = require('mongoose');
const path = require('path');
const Role = require('../modules/users/role.model');
const Settings = require('../modules/settings/settings.model');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        // 1. Update Role Collection
        const financeRole = await Role.findOne({ name: { $regex: /^finance$/i } });
        if (financeRole) {
            const perms = financeRole.permissions || {};
            if (perms['Payroll']?.['Payroll Engine']) {
                const initialCount = perms['Payroll']['Payroll Engine'].length;
                perms['Payroll']['Payroll Engine'] = perms['Payroll']['Payroll Engine'].filter(p => p !== 'disburse');
                
                if (perms['Payroll']['Payroll Engine'].length < initialCount) {
                    financeRole.markModified('permissions');
                    await financeRole.save();
                    console.log('✅ Finance role permissions updated in Role collection.');
                } else {
                    console.log('ℹ️ Finance role already lacked "disburse" permission.');
                }
            }
        } else {
            console.log('⚠️ Finance role not found in Role collection.');
        }

        // 2. Update Settings Singleton
        const settings = await Settings.findOne();
        if (settings && settings.roles) {
            let updated = false;
            settings.roles = settings.roles.map(role => {
                if (role.name.toLowerCase() === 'finance') {
                    const perms = role.permissions || {};
                    if (perms['Payroll']?.['Payroll Engine']) {
                        const initialCount = perms['Payroll']['Payroll Engine'].length;
                        perms['Payroll']['Payroll Engine'] = perms['Payroll']['Payroll Engine'].filter(p => p !== 'disburse');
                        if (perms['Payroll']['Payroll Engine'].length < initialCount) {
                            updated = true;
                        }
                    }
                }
                return role;
            });

            if (updated) {
                settings.markModified('roles');
                await settings.save();
                console.log('✅ Finance role permissions updated in Settings singleton.');
            } else {
                console.log('ℹ️ Finance role in Settings already lacks "disburse" permission.');
            }
        }

        console.log('🚀 MIGRATION COMPLETE: Finance role strictly restricted.');
        process.exit(0);

    } catch (err) {
        console.error('❌ MIGRATION FAILED:', err.message);
        process.exit(1);
    }
}

migrate();
