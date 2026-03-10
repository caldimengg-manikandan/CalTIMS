const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
    try {
        console.log('Attempting to connect to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('SUCCESS: MongoDB is reachable');
        process.exit(0);
    } catch (err) {
        console.error('FAILURE: Could not connect to MongoDB:', err.message);
        process.exit(1);
    }
};

testConnection();
