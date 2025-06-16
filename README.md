# Sports Direct Rota Automation

This project automates adding work shifts from the Sports Direct employee portal to your Google Calendar. It uses **Puppeteer** to log in to the rota website, scrapes the upcoming shifts and creates calendar events through the **Google Calendar API**.

## Features

- Headless login to the Sports Direct portal
- Extracts weekly shift information
- Automatically creates events in your Google Calendar

## Requirements

- [Node.js](https://nodejs.org/) and npm (or Yarn)
- A Google API credentials file (`client_secret.json`)
- Your Sports Direct payroll number and password

## Installation

1. Clone this repository and install dependencies:
   ```bash
   git clone <repository-url>
   cd sd-rota-automation
   npm install       # or "yarn install"
   ```
2. Place your Google credentials JSON in the project root as `client_secret.json`.
3. Create a `keys.js` file containing your login details:
   ```javascript
   module.exports = {
     payroll: 'YOUR_PAYROLL_NUMBER',
     password: 'YOUR_PASSWORD'
   };
   ```
4. Review `conf.js` if you need to update the calendar ID or token paths.

## Usage

Run the script with Node:

```bash
node app.js
```

On the first run you will be prompted to visit an authorization URL to grant calendar access. Paste the resulting code back into the terminal and the script will store a token for subsequent runs.

## License

This project is released under the [ISC License](https://opensource.org/licenses/ISC).
