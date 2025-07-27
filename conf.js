
const path = require('path');
const os = require('os');

module.exports = {
  SCOPES: ['https://www.googleapis.com/auth/calendar.events'],
  CLIENT_PATH: './client_secret.json',
  TOKEN_PATH: './token.json',
  CALENDAR_ID: '6pesae36o0h2ridoea6ashoaq4@group.calendar.google.com',
  LIST_ORDER: 'startTime',
  BULK_RESULT: ['id', 'summary', 'htmlLink'],
  EVENT_DURATION: 60
};
