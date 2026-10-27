import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3199', viewport: { width: 1440, height: 940 }, launchOptions: process.env.BYZ_TEST_BROWSER ? { executablePath: process.env.BYZ_TEST_BROWSER } : {} },
  webServer: { command: 'node server/index.js', port: 3199, reuseExistingServer: false, env: { PORT: '3199', BYZ_DATA_DIR: '.data/e2e' } },
});
