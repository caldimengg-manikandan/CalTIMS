'use strict';

const mongoose = require('mongoose');
const hikcentralService = require('./src/modules/attendance/hikcentral.service');
const Device = require('./src/modules/attendance/device.model');
const Settings = require('./src/modules/settings/settings.model');

// This script now pulls credentials directly from Settings collection

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://127.0.0.1:27017/timesheet_db');
    console.log('Connected.');

    // 1. Fetch Settings
    console.log('Fetching Settings...');
    const settings = await Settings.findOne({});
    if (!settings?.hardwareGateways?.hikvision?.host) {
      throw new Error('HikCentral settings not found in database. Please configure via UI.');
    }
    const config = settings.hardwareGateways.hikvision;

    // 2. Ensure a Device exists for this host
    console.log('Checking for Device entry...');
    let device = await Device.findOne({ name: 'Office HikCentral' });
    if (!device) {
      console.log('Creating new Device entry...');
      device = await Device.create({
        name: 'Office HikCentral',
        type: 'hikcentral',
        enabled: true,
        config: {
          host: config.host,
          appKey: config.appKey,
          appSecret: config.appSecret,
          port: config.port || '443'
        }
      });
    } else {
      console.log('Device already exists, ensuring it is enabled and config is current.');
      device.enabled = true;
      device.config = {
        host: config.host,
        appKey: config.appKey,
        appSecret: config.appSecret,
        port: config.port || '443'
      };
      device.lastSyncAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24h for manual pull
      await device.save();
    }

    // 3. Trigger Sync
    console.log('Triggering Synchronization...');
    const results = await hikcentralService.syncAll();
    console.log('Sync Results:', JSON.stringify(results, null, 2));

    console.log('Manual sync process finished.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

run();
