import { defineConfig, devices } from '@playwright/test';

// The API only answers with the pre-shared token from the backend's env.
process.loadEnvFile('backend/.env');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.API_TOKEN}` },
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'API Tests',
      testMatch: /.*\.api\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'cd backend && pnpm dev',
    url: 'http://localhost:3000/api/debug',
    reuseExistingServer: true, // Always reuse - dev server usually already running
    timeout: 120000,
  },
});
