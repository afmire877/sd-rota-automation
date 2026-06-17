const moment = require('moment-timezone');

const TIMEZONE = 'Europe/London';
const DATE_FORMAT = 'DD MMM YYYY';

/**
 * Build a Google Calendar event resource for a single shift.
 *
 * @param {string} date  Shift date, e.g. "23 Jun 2026".
 * @param {string} start Start time in "HH:mm", e.g. "09:00".
 * @param {string} end   End time in "HH:mm", e.g. "17:30".
 * @param {string} [summary] Event title.
 * @returns {object} Google Calendar event resource.
 */
function createShiftEvent(date, start, end, summary = 'Sports Direct shift') {
  return {
    summary,
    start: {
      dateTime: moment.tz(`${date} ${start}`, `${DATE_FORMAT} HH:mm`, TIMEZONE).format(),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: moment.tz(`${date} ${end}`, `${DATE_FORMAT} HH:mm`, TIMEZONE).format(),
      timeZone: TIMEZONE,
    },
  };
}

/**
 * Resolve the calendar date of a named weekday within a given week.
 *
 * @param {string} weekDate A date inside the target week, e.g. "22 Jun 2026".
 * @param {string} dayName  Weekday name, e.g. "Monday".
 * @returns {string} The resolved date formatted as "DD MMM YYYY".
 */
function resolveShiftDate(weekDate, dayName) {
  return moment(weekDate, DATE_FORMAT).day(dayName).format(DATE_FORMAT);
}

module.exports = { createShiftEvent, resolveShiftDate, TIMEZONE, DATE_FORMAT };
