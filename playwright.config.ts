import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // e2e.json is a machine-readable summary for agents and scripts.
  reporter: [[process.env.CI ? 'github' : 'list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Tests serve the dataset from e2e/fixtures; a service worker would bypass page.route.
    serviceWorkers: 'block'
  },
  webServer: [
    {
      command: 'LANDING_DATA=../../e2e/fixtures/data pnpm --filter @vegdex/web build && pnpm --filter @vegdex/web preview --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      // The same build with the fixtures served for real, so the service worker can cache them.
      // It answers 404 until the build above writes apps/web/dist.
      command: 'node e2e/offline-server.ts 4175',
      url: 'http://localhost:4175',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ],
  projects: [
    { name: 'mobile', testIgnore: 'offline.spec.ts', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', testIgnore: 'offline.spec.ts', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'offline',
      testMatch: 'offline.spec.ts',
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4175', serviceWorkers: 'allow' }
    }
  ]
});
