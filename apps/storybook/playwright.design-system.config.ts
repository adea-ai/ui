import { defineConfig, devices } from '@playwright/test'

// Renders every design-system card in a blank page, the way the published artifact
// does. Reads packages/ui/design-system/out, so build it first.
export default defineConfig({
  testDir: './tests',
  testMatch: 'design-system.spec.ts',
  outputDir: './test-results/design-system-runs',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 30_000,
  use: { headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
