const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {google} = require('googleapis');
const moment = require('moment');
const tz = require('moment-timezone');
const conf = require('./conf');
const payrollKey = require('./keys');




/**
 * Generate consent page URL
 * @returns {Promise}
 */
const generateUrl = async () => {
  const oauth2Client = getOauth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: conf.SCOPES
  });
  console.log('Authorize this app by visiting this url:', authUrl);
};








// /**
//  * Get and store new token after prompting for user authorization, and then
//  * execute the given callback with the authorized OAuth2 client.
//  * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
//  * @param {getEventsCallback} callback The callback for the authorized client.
//  */
function getAccessToken() {

  const oAuth2Client = getOauth2Client();
   generateUrl()
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(conf.TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', conf.TOKEN_PATH);
      });
      // callback(oAuth2Client);
    });
  });
}
/**
 * Lists the next 10 events on the user's primary calendar.
 */

function listEvents() {
    const calendar = getCalenderClient();
    calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    } else {
      console.log('No upcoming events found.');
    }
  });
}

const getOauth2Client = () => {
  const content = fs.readFileSync(conf.CLIENT_PATH);
  const {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: redirectUris
  } = JSON.parse(content).installed
  return new google.auth.OAuth2(clientId, clientSecret, redirectUris[0]);
}



// get Calender Client
const getCalenderClient = () => {
  const oauth2Client = getOauth2Client();
  const token = fs.readFileSync(conf.TOKEN_PATH);
  oauth2Client.setCredentials(JSON.parse(token));
  return google.calendar({version: 'v3', auth: oauth2Client});
}



/**
 * creates events on the user's primary calendar.
 */
function createEvent(event) {
  const calendar = getCalenderClient();
  calendar.events.insert({
  calendarId: conf.CALENDAR_ID,
  resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.data.htmlLink);
  });
}



function Event(date, start, end, summary) {
  return {
    summary,
    'start' : {
      'dateTime' : moment.utc( date+ ' ' +start, "DD MMM YYYY HH:mm").tz('Europe/London').format(),
      'timeZone' : 'Europe/Belfast'
    },
    'end' : {
      'dateTime' : moment.utc( date+ ' ' +end, "DD MMM YYYY HH:mm").tz('Europe/London').format(),
      'timeZone' : 'Europe/Belfast'
    }
  }

}
var eventExample = {
  'summary': 'Google I/O 2015',
  'location': '800 Howard St., San Francisco, CA 94103',
  'description': 'A chance to hear more about Google\'s developer products.',
  'start': {
    'dateTime': '2019-08-28T09:00:00',
    'timeZone': 'Europe/Belfast',
  },
  'end': {
    'dateTime': '2019-08-28T17:00:00',
    'timeZone': 'Europe/Belfast',
  },
  'recurrence': [
    'RRULE:FREQ=DAILY;COUNT=2'
  ],
  'attendees': [
    {'email': 'lpage@example.com'},
    {'email': 'sbrin@example.com'},
  ],
  'reminders': {
    'useDefault': false,
    'overrides': [
      {'method': 'email', 'minutes': 24 * 60},
      {'method': 'popup', 'minutes': 10},
    ],
  },
};

let scrape = async () => {


  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://memployees.sportsdirectservices.com', { waitUntil : 'networkidle2'});

  await page.click('#dnn_ctr462_Login_Login_DNN_txtUsername');
  await page.keyboard.type(payrollKey.payroll);

  await page.click('#dnn_ctr462_Login_Login_DNN_txtPassword');
  await page.keyboard.type(payrollKey.password);
  await page.click('#dnn_ctr462_Login_Login_DNN_cmdLogin' );
  console.log('logging in..');
  await page.waitFor(1000);
  const page2 = await browser.newPage();
  await page2.goto('https://memployees.sportsdirectservices.com/Home/Working-Hours', { waitUntil : 'networkidle2'});

  const result = await page2.evaluate(() => {
    let tbody = document.querySelectorAll('tbody');
    let thisWeekDate = dateExtractor(document.querySelector('#dnn_ctr454_ModuleContent > div > div:nth-child(1) > div > h3'));
    let nextWeekDate = dateExtractor(document.querySelector('#dnn_ctr454_WorkingHoursView_NextWeekPanel > div:nth-child(1) > div > h3'));

    // Extracts the date and puts in dd MMM YYYY format
    function dateExtractor(node){
      let date = node.innerHTML.split('-')[1].split('')
      date.shift()
      date.pop()
      date = date.join('')
      return date
    }

    function tableScraper(node, weekDate, alias){
      let week = [weekDate];
      let  day, start, end;


      
      let rows = node.querySelectorAll('tr');
      rows.forEach((e) => {

        let dateToday = ''

        day = e.cells[0].innerHTML;
        start = e.cells[1].innerHTML.match(/\d\d:\d\d/gi);
        end = e.cells[2].innerHTML.match(/\d\d:\d\d/gi);
        if(start != null) {
          start = start.toString();
          end   = end.toString();
          week.push({dateToday, day, start, end });
        }



      })


      return {...week}
    }
      let thisWeek = tableScraper(tbody[0], thisWeekDate, `thisweek`);
      let nextWeek = tableScraper(tbody[1], nextWeekDate, 'nextWeek');
    
    return {thisWeek, nextWeek}

  })
  
  await browser.close();
  return result;
}


scrape()
  .then((value) => {

    // let weekDates = [Object.values(value.thisWeek)[0], Object.values(value.nextWeek)[1]];
    let thisWeekDate = Object.values(value.thisWeek)[0];
    let nextWeekDate = Object.values(value.nextWeek)[0];
    

    // for (let x of Object.values(value.thisWeek)) {
    // if (typeof x !== 'object') { continue; } 
    //   // adds the dates for the week
    // if( x.dateToday == ''){
    //   x.dateToday = moment(thisWeekDate, 'DD MMM YYYY').day(x.day).format('DD MMM YYYY');
    // }
    // let event = new Event(x.dateToday, x.start, x.end, 'Sports Direct shift');
    // createEvent(event)
    // }
    for (let x of Object.values(value.nextWeek)) {
      if (typeof x !== 'object') { continue; } 
        // adds the dates for the week
      if( x.dateToday == ''){
        x.dateToday = moment(nextWeekDate, 'DD MMM YYYY').day(x.day).format('DD MMM YYYY');
      }
      let event = new Event(x.dateToday, x.start, x.end, 'Sports Direct shift');
      createEvent(event)
      }
  })
  .catch(error => {
    console.log(error)
  });




