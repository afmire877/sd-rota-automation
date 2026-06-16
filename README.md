# Sports Direct Rota Automation

This project automates adding work shifts from the Sports Direct employee portal to your Google Calendar. It uses **Puppeteer** to log in to the rota website, scrapes the upcoming shifts and creates calendar events through the **Google Calendar API**.

## Features

- Headless login to the Sports Direct portal
- Extracts weekly shift information
- Automatically creates events in your Google Calendar

## Requirements

- [Node.js](https://nodejs.org/) **20.6 or newer** (the start script uses the
  built-in `--env-file` flag) and npm (or Yarn)
- A Google API credentials file (`client_secret.json`)
- Your Sports Direct payroll number and password

## Installation

1. Clone this repository and install dependencies:

   ```bash
   git clone <repository-url>
   cd sd-rota-automation
   yarn install      # or "npm install"
   ```

2. Place your Google credentials JSON in the project root as `client_secret.json`.

3. Create a `.env` file from the template and fill in your details:

   ```bash
   cp .env.example .env
   ```

   ```dotenv
   SD_PAYROLL=your_payroll_number
   SD_PASSWORD=your_password
   GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
   ```

   `.env` is git-ignored, so your credentials never get committed.

   > **Legacy fallback:** if you previously used a `keys.js` file
   > (`module.exports = { payroll, password }`), it is still read when the
   > matching environment variables are not set.

## Usage

Authorize calendar access once (stores a reusable token in `token.json`):

```bash
yarn auth
```

This prints an authorization URL — visit it, grant access, and paste the
resulting code back into the terminal.

Then run the sync to scrape your rota and create the calendar events:

```bash
yarn start
```

## Scripts

| Script        | Description                                         |
| ------------- | --------------------------------------------------- |
| `yarn start`  | Scrape the rota and create calendar events          |
| `yarn auth`   | Run the one-time Google OAuth flow to store a token |
| `yarn test`   | Run the unit tests (`node --test`)                  |
| `yarn lint`   | Lint with ESLint                                    |
| `yarn format` | Format the codebase with Prettier                   |

## Project structure

```
app.js            Orchestration: login, scrape, OAuth, create events
lib/shifts.js     Pure shift helpers (createShiftEvent, resolveShiftDate)
config.js         Resolves portal credentials from env (keys.js fallback)
conf.js           Calendar/OAuth configuration (env-overridable)
test/             Unit tests for the pure logic
```

## Known limitations

- The scraper relies on hardcoded portal CSS selectors (in `app.js`). If Sports
  Direct change their page markup, the selectors will need updating.
- Re-running `yarn start` does not de-duplicate; it creates fresh events each
  time rather than reconciling existing ones.

## License

This project is released under the [ISC License](https://opensource.org/licenses/ISC).
