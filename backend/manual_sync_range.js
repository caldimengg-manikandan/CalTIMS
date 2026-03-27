'use strict';

const mongoose = require('mongoose');
const hikcentralService = require('./src/modules/attendance/hikcentral.service');
const Device = require('./src/modules/attendance/device.model');
const logger = require('./src/shared/utils/logger');

async function run() {
  const args = process.argv.slice(2);
  const startTimeStr = args[0] || '2026-03-16T00:00:00';
  const endTimeStr = args[1] || new Date().toISOString();

  const startTime = new Date(startTimeStr);
  const endTime = new Date(endTimeStr);

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    console.error('Invalid date format. Use YYYY-MM-DD or ISO string.');
    process.exit(1);
  }

  try {
    console.log(`Connecting to MongoDB...`);
    // Connect using the same logic as your app
    await mongoose.connect('mongodb://127.0.0.1:27017/timesheet_db');
    console.log('Connected.');

    console.log(`Triggering HikCentral sync from ${startTime.toISOString()} to ${endTime.toISOString()}...`);

    const results = await hikcentralService.syncAll({
      startTime,
      endTime
    });

    console.log('Sync Results:', JSON.stringify(results, null, 2));

    let totalProcessed = 0;
    results.forEach(r => {
      if (r.success) totalProcessed += (r.processed || 0);
    });

    console.log(`\nSynchronization finished. Total logs processed: ${totalProcessed}`);
    
    // Check for "validity expired" error in results
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      console.warn('\nSome devices failed to sync:');
      errors.forEach(e => console.error(`Device ${e.deviceId}: ${e.error}`));
      
      if (JSON.stringify(errors).includes('validity time has expired')) {
        console.error('\n[CRITICAL] One or more devices failed with "consumer validity time has expired".');
        console.error('Please update the AppKey validity in HikCentral Professional Open API settings.');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Fatal Error during manual sync:', err);
    process.exit(1);
  }
}

run();
