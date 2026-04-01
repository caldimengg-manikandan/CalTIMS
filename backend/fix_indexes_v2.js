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

      // Drop unique indexes missing organizationId
      for (const idx of indexes) {
        if (idx.unique && !idx.key.organizationId) {
          console.log(`!!! Found problematic global unique index: ${idx.name}. Dropping...`);
          await col.dropIndex(idx.name);
          console.log('Dropped successfully.');
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
