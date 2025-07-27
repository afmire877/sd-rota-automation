const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const moment = require('moment-timezone');
const conf = require('./conf');
const credentials = require('./keys');

const SELECTORS = {
  USERNAME: '#dnn_ctr462_Login_Login_DNN_txtUsername',
  PASSWORD: '#dnn_ctr462_Login_Login_DNN_txtPassword',
  LOGIN_BUTTON: '#dnn_ctr462_Login_Login_DNN_cmdLogin',
  THIS_WEEK_HEADER: '#dnn_ctr454_ModuleContent > div > div:nth-child(1) > div > h3',
  NEXT_WEEK_HEADER: '#dnn_ctr454_WorkingHoursView_NextWeekPanel > div:nth-child(1) > div > h3'
};

const URLS = {
  LOGIN: 'https://memployees.sportsdirectservices.com',
  ROTA: 'https://memployees.sportsdirectservices.com/Home/Working-Hours'
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
    output: process.stdout 
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

async function loginAndScrape() {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(URLS.LOGIN, { waitUntil: 'networkidle2' });

    await page.type(SELECTORS.USERNAME, credentials.payroll);
    await page.type(SELECTORS.PASSWORD, credentials.password);
    await page.click(SELECTORS.LOGIN_BUTTON);
    await page.waitForTimeout(1000);

    const rota = await browser.newPage();
    await rota.goto(URLS.ROTA, { waitUntil: 'networkidle2' });

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
            week.push({ 
              day, 
              start: start[0], 
              end: end[0] 
            });
          }
        });
        return week;
      };
      
      const bodies = document.querySelectorAll('tbody');
      const thisWeekDate = parseDate(
        document.querySelector('#dnn_ctr454_ModuleContent > div > div:nth-child(1) > div > h3')
      );
      const nextWeekDate = parseDate(
        document.querySelector('#dnn_ctr454_WorkingHoursView_NextWeekPanel > div:nth-child(1) > div > h3')
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
    
    shifts.nextWeek.slice(1).forEach(shift => {
      const date = moment(nextWeekDate, 'DD MMM YYYY')
        .day(shift.day)
        .format('DD MMM YYYY');
      const event = createShiftEvent(date, shift.start, shift.end);
      createEvent(event);
    });
  } catch (err) {
    console.error('Main function error:', err);
  }
}

main();
