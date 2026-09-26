import { defineConfig, devices } from '@playwright/test'

// Isolated component interactions render a real bundled Solid entry in a blank
// browser page. No dev server, app backend, or alternate product route is used.
export default defineConfig({
  testDir: './tests',
  testMatch: 'component-split-layout.spec.ts',
  outputDir: './test-results/layout',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: { headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
