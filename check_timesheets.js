const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: 'c:/Users/USER/Desktop/TIMESHEET/backend/.env' });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Timesheet = require('c:/Users/USER/Desktop/TIMESHEET/backend/src/modules/timesheets/timesheet.model');
        const { getWeekStart } = require('c:/Users/USER/Desktop/TIMESHEET/backend/src/shared/utils/dateHelpers');

        const weekStart = getWeekStart(new Date('2026-03-02'));
        console.log('Week Start:', weekStart.toISOString());

        const timesheets = await Timesheet.find({ weekStartDate: weekStart }).lean();
        console.log(`Found ${timesheets.length} timesheets for this week`);

        timesheets.forEach(ts => {
            console.log(`TS ID: ${ts._id}, User: ${ts.userId}, Status: ${ts.status}, TotalHours: ${ts.totalHours}`);
            ts.rows.forEach((row, i) => {
                console.log(`  Row ${i}: Project: ${row.projectId}, Category: ${row.category}, TotalHours: ${row.totalHours}, Entries: ${row.entries?.length}`);
                if (row.entries) {
                    row.entries.forEach(e => {
                        console.log(`    Entry: Date: ${e.date}, Hours: ${e.hoursWorked}`);
                    });
                }
            });
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
