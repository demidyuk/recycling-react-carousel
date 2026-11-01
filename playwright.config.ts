import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:6017',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-smoke',
      testMatch: [
        'core-smoke.spec.ts',
        'gap.spec.ts',
        'drag.spec.ts',
        'api.spec.ts',
        'layouts.spec.ts',
        'sizing.spec.ts',
        'showcase.spec.ts',
        'input.spec.ts',
        'time-picker.spec.ts',
        'motion-api.spec.ts',
      ],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chromium-touch',
      testMatch: [
        'core-smoke.spec.ts',
        'layouts.spec.ts',
        'showcase.spec.ts',
        'input.spec.ts',
        'time-picker.spec.ts',
        'motion-api.spec.ts',
      ],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run storybook:test -- --ci --port 6017 --exact-port',
    url: 'http://127.0.0.1:6017',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
