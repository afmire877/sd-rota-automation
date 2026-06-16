module.exports = {
  SCOPES: ['https://www.googleapis.com/auth/calendar.events'],
  CLIENT_PATH: process.env.GOOGLE_CLIENT_PATH || './client_secret.json',
  TOKEN_PATH: process.env.GOOGLE_TOKEN_PATH || './token.json',
  CALENDAR_ID:
    process.env.GOOGLE_CALENDAR_ID ||
    '6pesae36o0h2ridoea6ashoaq4@group.calendar.google.com',
  EVENT_DURATION: 60,
};
