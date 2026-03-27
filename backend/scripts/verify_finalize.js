'use strict';

const mongoose = require('mongoose');
const User = require('../src/modules/users/user.model');
const ProcessedPayroll = require('../src/modules/payroll/processedPayroll.model');
const PayrollBatch = require('../src/modules/payroll/payrollBatch.model');
const { lockPayroll } = require('../src/modules/payroll/payroll.service');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/timesheet_db';

async function verifyFinalize() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to DB');

  const month = 3, year = 2026;
  const admin = await User.findOne({ email: 'admin@test.com' });
  
  console.log('--- BEFORE FINALIZE ---');
  const batchBefore = await PayrollBatch.findOne({ month, year });
  const sampleBefore = await ProcessedPayroll.findOne({ month, year });
  console.log(`Batch Status: ${batchBefore?.status}`);
  console.log(`Sample Record Status: ${sampleBefore?.status}, isLocked: ${sampleBefore?.isLocked}`);

  console.log('🚀 Finalizing Payroll (locking)...');
  await lockPayroll(month, year, admin._id);

  console.log('--- AFTER FINALIZE ---');
  const batchAfter = await PayrollBatch.findOne({ month, year });
  const sampleAfter = await ProcessedPayroll.findOne({ month, year });
  console.log(`Batch Status: ${batchAfter?.status}`);
  console.log(`Sample Record Status: ${sampleAfter?.status}, isLocked: ${sampleAfter?.isLocked}`);

  if (batchAfter.status === 'Completed' && sampleAfter.status === 'Completed') {
      console.log('✅ Status transition SUCCESSFUL');
  } else {
      console.log('❌ Status transition FAILED');
  }

  await mongoose.disconnect();
}

verifyFinalize().catch(console.error);
