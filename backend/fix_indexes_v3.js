'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const collections = ['payrollbatches', 'processedpayrolls', 'rolesalarystructures'];
    
    for (const colName of collections) {
      console.log(`\nChecking indexes for ${colName}...`);
      const col = mongoose.connection.collection(colName);
      const indexes = await col.indexes();
      console.log(JSON.stringify(indexes, null, 2));

      // Drop unique indexes missing organizationId OR missing effectiveFrom (for structures)
      for (const idx of indexes) {
        if (idx.unique) {
            const hasOrg = !!idx.key.organizationId;
            const isStructure = colName === 'rolesalarystructures';
            const hasEffectiveFrom = !!idx.key.effectiveFrom;

            if (!hasOrg || (isStructure && !hasEffectiveFrom)) {
                 console.log(`!!! Found problematic unique index: ${idx.name}. Dropping...`);
                 try {
                    await col.dropIndex(idx.name);
                    console.log('Dropped successfully.');
                 } catch (e) {
                    console.log(`Error dropping ${idx.name}: ${e.message}`);
                 }
            }
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
