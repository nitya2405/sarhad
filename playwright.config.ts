import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests against the offline dev server (no Supabase needed).
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } },
  webServer: {
    command: 'npx vite --mode offline --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
