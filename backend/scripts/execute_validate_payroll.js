'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { runPayroll } = require('../src/modules/payroll/payroll.service');
const ProcessedPayroll = require('../src/modules/payroll/processedPayroll.model');
const PayrollBatch = require('../src/modules/payroll/payrollBatch.model');
const User = require('../src/modules/users/user.model');
const logger = require('../src/shared/utils/logger');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/timesheet_db';

async function executeAndValidate() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  const month = 3;
  const year = 2026;

  console.log(`🚀 Executing Payroll for ${month}/${year}...`);
  
  try {
    const result = await runPayroll({ 
      month, 
      year, 
      processedBy: new mongoose.Types.ObjectId() // System Admin mock ID
    });

    console.log('✅ Payroll Execution Finished');
    console.log('-----------------------------------');
    console.log('Summary Stats:');
    console.log(`Total Employees Processed: ${result.totalEmployeesProcessed}`);
    console.log(`Success Count: ${result.successCount}`);
    console.log(`Failed Count: ${result.failedCount}`);
    console.log(`Anomaly Count: ${result.anomalyCount}`);
    console.log(`Total Gross: ${result.summaryStats.totalGross}`);
    console.log(`Total Net: ${result.summaryStats.totalNetPay}`);
    console.log('-----------------------------------');

    // 1. Assert records saved in DB
    const records = await ProcessedPayroll.find({ month, year });
    console.log(`📊 Records found in DB: ${records.length}`);
    
    if (records.length === 0) {
      throw new Error('Payroll not saved to DB');
    }

    // 2. Validate Output Correctness for each scenario
    const testEmails = [
      'fixed@test.com', 'hourly@test.com', 'lop@test.com', 'overtime@test.com',
      'zero@test.com', 'partial@test.com', 'high_deduction@test.com', 'mixed@test.com'
    ];

    for (const email of testEmails) {
      const user = await User.findOne({ email });
      if (!user) {
        console.warn(`⚠️ User not found for email: ${email}`);
        continue;
      }

      const record = records.find(r => r.user.toString() === user._id.toString());
      if (!record) {
        console.error(`❌ No payroll record found for ${email}`);
        continue;
      }

      console.log(`\n🔍 Validating Scenario: ${email}`);
      console.log(`   Name: ${record.employeeInfo.name}`);
      console.log(`   Gross: ${record.grossYield}`);
      console.log(`   Deductions: ${record.liability}`);
      console.log(`   Net Pay: ${record.netPay}`);
      console.log(`   Status: ${record.status}`);

      // NaN Check
      if (isNaN(record.grossYield) || isNaN(record.liability) || isNaN(record.netPay)) {
        throw new Error(`CRITICAL: NaN detected in payroll results for ${email}`);
      }

      // Specific asserts
      if (email === 'zero@test.com') {
          if (record.grossYield > 0 && record.paymentType === 'Monthly') {
              // Note: Monthly fixed might still have base salary if proration is off, but attendance is zero
              console.log(`   - Zero attendance case check: Gross=${record.grossYield}`);
          }
      }

      if (email === 'lop@test.com') {
          console.log(`   - LOP Check: lopDays=${record.attendance.lopDays}, lopDeduction=${record.breakdown.lopDeduction}`);
          if (record.attendance.lopDays !== 2) console.error(`     ❌ Expected 2 LOP days, got ${record.attendance.lopDays}`);
      }

      if (email === 'overtime@test.com') {
          const otComponent = record.breakdown.earnings.components.find(c => c.name.toLowerCase().includes('overtime'));
          console.log(`   - Overtime Check: ${otComponent ? `OT Pay=${otComponent.value}` : 'No OT Pay component found'}`);
      }
      
      if (email === 'partial@test.com') {
          console.log(`   - Partial Month Check: joined=${user.joinDate.toDateString()}, workedDays=${record.attendance.workedDays}`);
      }
      
      if (email === 'mixed@test.com') {
          const techBonus = record.breakdown.earnings.components.find(c => c.name === 'Technical Bonus');
          console.log(`   - Mixed Components Check: Technical Bonus=${techBonus ? techBonus.value : 'N/A'}`);
      }
    }

    // 3. Check PayrollBatch
    const batch = await PayrollBatch.findOne({ month, year });
    if (!batch) {
      throw new Error('PayrollBatch not created for the period');
    }
    console.log(`\n✅ PayrollBatch verified. Status: ${batch.status}`);

    logger.info("Employees processed:", result.totalEmployeesProcessed);
    logger.info("Payroll results:", result.details.length);
    logger.info("Saved records:", records.length);

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

executeAndValidate();
