'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../shared/utils/logger');

/**
 * Drop legacy unique indexes that are not intended to be there.
 */
async function dropLegacyIndexes() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    logger.error('No MONGODB_URI or MONGO_URI found in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Check roles collection for legacy name_1 index
    const rolesCollection = db.collection('roles');
    const roleIndexes = await rolesCollection.indexes();
    logger.info('Current indexes in roles collection:', JSON.stringify(roleIndexes, null, 2));

    const legacyRoleIndex = roleIndexes.find(idx => idx.name === 'name_1');
    if (legacyRoleIndex && legacyRoleIndex.unique) {
      logger.info('Dropping legacy unique index "name_1" from roles collection...');
      await rolesCollection.dropIndex('name_1');
      logger.info('Successfully dropped legacy role index.');
    } else {
      logger.info('No legacy unique index "name_1" found in roles collection.');
    }

    // 2. Check users collection for legacy global unique indexes
    const usersCollection = db.collection('users');
    const userIndexes = await usersCollection.indexes();
    logger.info('Current indexes in users collection:', JSON.stringify(userIndexes, null, 2));

    const legacyUserIndex = userIndexes.find(idx => idx.name === 'employeeId_1');
    if (legacyUserIndex && legacyUserIndex.unique) {
      logger.info('Dropping legacy global unique index "employeeId_1" from users collection...');
      await usersCollection.dropIndex('employeeId_1');
      logger.info('Successfully dropped legacy user employeeId index.');
    } else {
      logger.info('No legacy global unique index "employeeId_1" found in users collection.');
    }

    // 3. Check TrialTracking collection for potentially duplicate indexes
    const trialCollection = db.collection('trialtrackings');
    const trialIndexes = await trialCollection.indexes();
    logger.info('Current indexes in trialtrackings collection:', JSON.stringify(trialIndexes, null, 2));

    // Summary of all indexes for the developer to review
    logger.info('Index cleanup complete. New signup attempts should now succeed.');

  } catch (error) {
    logger.error('Error during index cleanup:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

dropLegacyIndexes();
