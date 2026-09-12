const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const conf = require('./conf');
const { getCredentials } = require('./config');
const { createShiftEvent, resolveShiftDate } = require('./lib/shifts');
const { syncShiftEvent } = require('./lib/calendar');

const SELECTORS = {
  USERNAME: '#dnn_ctr462_Login_Login_DNN_txtUsername',
  PASSWORD: '#dnn_ctr462_Login_Login_DNN_txtPassword',
  LOGIN_BUTTON: '#dnn_ctr462_Login_Login_DNN_cmdLogin',
  THIS_WEEK_HEADER: '#dnn_ctr454_ModuleContent > div > div:nth-child(1) > div > h3',
  NEXT_WEEK_HEADER:
    '#dnn_ctr454_WorkingHoursView_NextWeekPanel > div:nth-child(1) > div > h3',
};

const URLS = {
  LOGIN: 'https://memployees.sportsdirectservices.com',
  ROTA: 'https://memployees.sportsdirectservices.com/Home/Working-Hours',
};

function getOAuthClient() {
  const content = fs.readFileSync(conf.CLIENT_PATH);
  const { client_id, client_secret, redirect_uris } = JSON.parse(content).installed;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

function requestToken() {
  const oAuth2Client = getOAuthClient();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: conf.SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code here: ', code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      fs.writeFileSync(conf.TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to', conf.TOKEN_PATH);
    });
  });
}

function getCalendarClient() {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(JSON.parse(fs.readFileSync(conf.TOKEN_PATH)));
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

async function loginAndScrape() {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(URLS.LOGIN, { waitUntil: 'networkidle2' });

    const credentials = getCredentials();
    await page.waitForSelector(SELECTORS.USERNAME, { visible: true });
    await page.waitForSelector(SELECTORS.PASSWORD, { visible: true });
    await page.type(SELECTORS.USERNAME, credentials.payroll);
    await page.type(SELECTORS.PASSWORD, credentials.password);
    await page.waitForSelector(SELECTORS.LOGIN_BUTTON, { visible: true });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click(SELECTORS.LOGIN_BUTTON),
    ]);

    await page.goto(URLS.ROTA, { waitUntil: 'networkidle2' });
    await page.waitForSelector(SELECTORS.THIS_WEEK_HEADER, { visible: true });
    await page.waitForSelector(SELECTORS.NEXT_WEEK_HEADER, { visible: true });
    await page.waitForSelector('tbody');

    const data = await page.evaluate(() => {
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
            week.push({
              day,
              start: start[0],
              end: end[0],
            });
          }
        });
        return week;
      };

      const bodies = document.querySelectorAll('tbody');
      const thisWeekDate = parseDate(
        document.querySelector(
          '#dnn_ctr454_ModuleContent > div > div:nth-child(1) > div > h3'
        )
      );
      const nextWeekDate = parseDate(
        document.querySelector(
          '#dnn_ctr454_WorkingHoursView_NextWeekPanel > div:nth-child(1) > div > h3'
        )
      );

      return {
        thisWeek: scrapeTable(bodies[0], thisWeekDate),
        nextWeek: scrapeTable(bodies[1], nextWeekDate),
      };
    });

    return data;
  } catch (error) {
    console.error('Error during login and scrape:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  try {
    const shifts = await loginAndScrape();
    const nextWeekDate = shifts.nextWeek[0];
    const calendar = getCalendarClient();

    for (const shift of shifts.nextWeek.slice(1)) {
      const date = resolveShiftDate(nextWeekDate, shift.day);
      const event = createShiftEvent(date, shift.start, shift.end);
      const result = await syncShiftEvent(calendar, conf.CALENDAR_ID, event);
      console.log(`Event ${result.action}:`, result.event.htmlLink || result.event.id);
    }
  } catch (err) {
    console.error('Main function error:', err);
    process.exitCode = 1;
  }
}

// `node app.js auth` runs the one-time Google OAuth flow and stores a token;
// any other invocation scrapes the rota and creates calendar events.
if (process.argv[2] === 'auth') {
  requestToken();
} else {
  main();
}
