'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const collections = ['payrollbatches', 'processedpayrolls'];
    
    for (const colName of collections) {
      console.log(`\nChecking indexes for ${colName}...`);
      const col = mongoose.connection.collection(colName);
      const indexes = await col.indexes();
      console.log(JSON.stringify(indexes, null, 2));

      // Look for a unique index on 'month' alone
      const problematic = indexes.find(idx => 
        idx.unique && 
        Object.keys(idx.key).length === 1 && 
        idx.key.month === 1
      );

      if (problematic) {
        console.log(`!!! Found problematic unique index on 'month' only: ${problematic.name}. Dropping...`);
        await col.dropIndex(problematic.name);
        console.log('Dropped successfully.');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
