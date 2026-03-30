'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/caltims';

async function fix() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        const db = mongoose.connection.db;
        const rolesCollection = db.collection('roles');

        console.log('Dropping all indexes on "roles" collection to fix multi-tenant scoping...');
        try {
            await rolesCollection.dropIndexes();
            console.log('Dropped all indexes on "roles".');
        } catch (e) {
            console.log('Error dropping indexes (maybe they dont exist):', e.message);
        }

        console.log('Indexes will be recreated by Mongoose on the next app start with correct scoping.');
    } catch (error) {
        console.error('Fix failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fix();
