const mongoose = require('mongoose');
const AttendanceLog = require('./src/modules/attendance/attendance.model');
const fs = require('fs');

async function check() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/timesheet_db');
    const count = await AttendanceLog.countDocuments({ timestamp: { $gte: new Date('2026-03-16T00:00:00Z') } });
    fs.writeFileSync('log_count.txt', 'Count: ' + count);
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('log_count.txt', 'Error: ' + err.message);
    process.exit(1);
  }
}
check();
