'use strict';

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const Role = require('../modules/users/role.model');
const Organization = require('../modules/organizations/organization.model');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caltims';

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db;
    const rolesCollection = db.collection('roles');

    // 1. Drop existing global unique index on roles "name"
    console.log('Forcing drop of global unique index on roles "name"...');
    try {
      await rolesCollection.dropIndex('name_1');
      console.log('Successfully dropped roles "name_1" index.');
    } catch (e) {
      console.log('Note: roles "name_1" index not found or already dropped.');
    }

    try {
      console.log('Dropping all other non-id indexes on roles...');
      await rolesCollection.dropIndexes();
      console.log('All roles indexes dropped.');
    } catch (e) {
      console.log('Warning during bulk roles index drop:', e.message);
    }

    // 1b. Drop existing global unique index on users "employeeId"
    const usersCollection = db.collection('users');
    console.log('Forcing drop of global unique index on users "employeeId"...');
    try {
      await usersCollection.dropIndex('employeeId_1');
      console.log('Successfully dropped users "employeeId_1" index.');
    } catch (e) {
      console.log('Note: users "employeeId_1" index not found or already dropped.');
    }

    // 2. Identify "System Default" organization or create one
    let systemOrg = await Organization.findOne({ name: 'System Default' });
    if (!systemOrg) {
      console.log('Creating System Default organization...');
      systemOrg = await Organization.create({ name: 'System Default' });
    }

    // 3. Assign roles with missing organizationId to System Default
    console.log('Assigning orphaned roles to System Default organization...');
    const result = await Role.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: systemOrg._id } }
    );
    console.log(`Updated ${result.modifiedCount} orphaned roles.`);

    // 4. Handle duplicates that would break the new unique index
    // If two roles with same name were assigned to System Default, we should merge or rename
    const roles = await Role.find({ organizationId: systemOrg._id });
    const seenNames = new Set();
    for (const role of roles) {
      if (seenNames.has(role.name)) {
        console.log(`Duplicate role name "${role.name}" found in System Default. Cleaning up...`);
        // Option: Delete duplicates or suffix them
        await Role.deleteOne({ _id: role._id });
      } else {
        seenNames.add(role.name);
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrate();
