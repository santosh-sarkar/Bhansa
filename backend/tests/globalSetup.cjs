const { execSync } = require('node:child_process');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

module.exports = function setup() {
  try {
    require('process').loadEnvFile(path.join(backendRoot, '.env'));
  } catch {
    // CI supplies the variables directly.
  }

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required to run the backend tests.');
  }

  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
};
