import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests against the offline dev server (no Supabase needed).
// chromium: everything except the iPhone spec. webkit-iphone: iOS Safari behaviour (iPhone 13 profile).
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'chromium',
      testIgnore: /iphone\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } },
    },
    {
      name: 'webkit-iphone',
      testMatch: /iphone\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npx vite --mode offline --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
