const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const moment = require('moment-timezone');
const conf = require('./conf');
const credentials = require('./keys');

/**
 * Creates and returns a Google OAuth2 client using credentials from a local file.
 *
 * @returns {OAuth2Client} An OAuth2 client configured with client ID, secret, and redirect URI.
 */
function getOAuthClient() {
  const content = fs.readFileSync(conf.CLIENT_PATH);
  const { client_id, client_secret, redirect_uris } = JSON.parse(content).installed;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * Initiates the OAuth2 authorization flow to obtain and store a Google API access token.
 *
 * Prompts the user to visit an authorization URL and enter the resulting code, then exchanges the code for an access token and saves it to disk for future use.
 */
function requestToken() {
  const oAuth2Client = getOAuthClient();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: conf.SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter the code here: ', code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      fs.writeFileSync(conf.TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to', conf.TOKEN_PATH);
    });
  });
}

/**
 * Returns an authenticated Google Calendar API client using stored OAuth2 credentials.
 *
 * @returns {import('googleapis').calendar_v3.Calendar} An authenticated Google Calendar client.
 */
function getCalendarClient() {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(JSON.parse(fs.readFileSync(conf.TOKEN_PATH)));
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Inserts an event into the configured Google Calendar.
 *
 * @param {object} event - The event object to be added to the calendar.
 *
 * @remark
 * Logs the event link on success or logs an error if the insertion fails.
 */
async function createEvent(event) {
  try {
    const calendar = getCalendarClient();
    const res = await calendar.events.insert({
      calendarId: conf.CALENDAR_ID,
      resource: event,
    });
    console.log('Event created:', res.data.htmlLink);
  } catch (err) {
    console.error('Calendar error:', err);
  }
}

/**
 * Creates a Google Calendar event object for a work shift with specified date, start and end times.
 *
 * @param {string} date - The date of the shift in 'DD MMM YYYY' format.
 * @param {string} start - The shift start time in 'HH:mm' format.
 * @param {string} end - The shift end time in 'HH:mm' format.
 * @param {string} [summary='Sports Direct shift'] - The event summary or title.
 * @returns {Object} A calendar event object with correctly formatted start and end times in the 'Europe/Belfast' timezone.
 */
function createShiftEvent(date, start, end, summary = 'Sports Direct shift') {
  return {
    summary,
    start: {
      dateTime: moment.tz(`${date} ${start}`, 'DD MMM YYYY HH:mm', 'Europe/London').format(),
      timeZone: 'Europe/Belfast',
    },
    end: {
      dateTime: moment.tz(`${date} ${end}`, 'DD MMM YYYY HH:mm', 'Europe/London').format(),
      timeZone: 'Europe/Belfast',
    },
  };
}

/**
 * Automates login to the Sports Direct employee portal and scrapes work shift data for the current and next week.
 *
 * @returns {Promise<{thisWeek: Array, nextWeek: Array}>} An object containing arrays of shift data for this week and next week, each including the week date and daily shift details.
 */
async function loginAndScrape() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://memployees.sportsdirectservices.com', { waitUntil: 'networkidle2' });

  await page.type('#dnn_ctr462_Login_Login_DNN_txtUsername', credentials.payroll);
  await page.type('#dnn_ctr462_Login_Login_DNN_txtPassword', credentials.password);
  await page.click('#dnn_ctr462_Login_Login_DNN_cmdLogin');
  await page.waitForTimeout(1000);

  const rota = await browser.newPage();
  await rota.goto('https://memployees.sportsdirectservices.com/Home/Working-Hours', { waitUntil: 'networkidle2' });

  const data = await rota.evaluate(() => {
    const parseDate = node => {
      const text = node.innerText.split('-')[1].trim();
      return text.slice(1, -1);
    };
    const scrapeTable = (table, weekDate) => {
      const week = [weekDate];
      table.querySelectorAll('tr').forEach(row => {
        const day = row.cells[0].innerText;
        const start = row.cells[1].innerText.match(/\d\d:\d\d/);
        const end = row.cells[2].innerText.match(/\d\d:\d\d/);
        if (start && end) {
          week.push({ day, start: start[0], end: end[0] });
        }
      });
      return week;
    };
    const bodies = document.querySelectorAll('tbody');
    const thisWeekDate = parseDate(document.querySelector('#dnn_ctr454_ModuleContent > div > div:nth-child(1) > div > h3'));
    const nextWeekDate = parseDate(document.querySelector('#dnn_ctr454_WorkingHoursView_NextWeekPanel > div:nth-child(1) > div > h3'));
    return {
      thisWeek: scrapeTable(bodies[0], thisWeekDate),
      nextWeek: scrapeTable(bodies[1], nextWeekDate),
    };
  });

  await browser.close();
  return data;
}

/**
 * Scrapes next week's work shifts and creates corresponding events in Google Calendar.
 *
 * Automates the process of logging into the employee portal, extracting shift data for the upcoming week, and creating calendar events for each shift.
 *
 * @remark Only next week's shifts are processed and added to the calendar.
 */
async function main() {
  try {
    const shifts = await loginAndScrape();
    const nextWeekDate = shifts.nextWeek[0];
    shifts.nextWeek.slice(1).forEach(shift => {
      const date = moment(nextWeekDate, 'DD MMM YYYY').day(shift.day).format('DD MMM YYYY');
      const event = createShiftEvent(date, shift.start, shift.end);
      createEvent(event);
    });
  } catch (err) {
    console.error(err);
  }
}

main();
