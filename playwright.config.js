import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  testMatch: [
    'chiefNurseWorkflow.spec.js',
    'leadershipWorkflow.spec.js',
    'ownerWorkflow.spec.js',
    'accessGateSecurity.spec.js',
    'concurrencyAndViewports.spec.js',
    'authHandshake.spec.js',
    'offlineSync.spec.js',
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Unset everywhere that matters (CI, ordinary dev): Playwright
        // downloads its own pinned browser as usual. Only a sandbox with a
        // pre-installed Chromium at a fixed, non-standard path needs this.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve.js 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
