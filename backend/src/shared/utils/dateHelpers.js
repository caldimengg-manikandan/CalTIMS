'use strict';

/**
 * Date and week calculation utilities
 */

/**
 * Get the start of the week for a given date.
 * @param {Date|string} date 
 * @param {string} weekStartDay 'monday' or 'sunday' (default 'monday')
 */
const getWeekStart = (date = new Date(), weekStartDay = 'monday') => {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  
  let diff;
  if (weekStartDay.toLowerCase() === 'sunday') {
    // If it's Sunday (0), diff is 0. 
    // Otherwise, go back 'day' days.
    diff = d.getUTCDate() - day;
  } else {
    // Monday start (default)
    // If it's Sunday (0), go back 6 days.
    // Otherwise, go back (day - 1) days.
    diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  }
  
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the end of the week for a given date
 * @param {Date|string} date 
 * @param {string} weekStartDay 'monday' or 'sunday' (default 'monday')
 */
const getWeekEnd = (date = new Date(), weekStartDay = 'monday') => {
  const start = getWeekStart(date, weekStartDay);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

/**
 * Get all dates (array) for a given week start
 */
const getWeekDates = (weekStart) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

/**
 * Calculate number of working days between two dates (Mon-Fri)
 */
const getWorkingDays = (startDate, endDate) => {
  let count = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/**
 * Format a date to YYYY-MM-DD string
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

module.exports = { getWeekStart, getWeekEnd, getWeekDates, getWorkingDays, formatDate };
