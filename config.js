/**
 * Resolves the Sports Direct portal credentials.
 *
 * Preferred source is environment variables (e.g. loaded from a `.env` file via
 * `node --env-file=.env`). For backward compatibility, a legacy `keys.js` file
 * exporting `{ payroll, password }` is used as a fallback when the environment
 * variables are not set.
 *
 * @returns {{ payroll: string, password: string }}
 */
function getCredentials() {
  let payroll = process.env.SD_PAYROLL;
  let password = process.env.SD_PASSWORD;

  if (!payroll || !password) {
    try {
      // Legacy fallback — kept so existing setups keep working.
      const keys = require('./keys');
      payroll = payroll || keys.payroll;
      password = password || keys.password;
    } catch {
      // No keys.js present; rely solely on environment variables.
    }
  }

  if (!payroll || !password) {
    throw new Error(
      'Missing Sports Direct credentials. Set SD_PAYROLL and SD_PASSWORD ' +
        '(see .env.example) or provide a keys.js file.'
    );
  }

  return { payroll, password };
}

module.exports = { getCredentials };
