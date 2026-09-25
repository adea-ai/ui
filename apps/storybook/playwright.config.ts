import { defineConfig, devices } from '@playwright/test'

/**
 * The design system's browser lane.
 *
 * It runs against the **built** workshop rather than the dev server, so the
 * thing being checked is the thing a reviewer downloads, and a build-time
 * problem cannot be masked by an incremental one.
 *
 * The stories are discovered from Storybook's own `index.json`, so a new story
 * is covered the moment it exists. That is deliberate: a lane that enumerates
 * stories by hand is a lane that silently stops covering the newest component.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  /*
   * Two workers, in CI and locally.
   *
   * The lane serves the workshop from a single static process, and each worker
   * loads a full story page. Six workers against one server means every page
   * waits on the others, and tests that pass in isolation time out — a flake
   * that looks like a component defect and is not one. The lane takes about
   * three minutes at this width, which is cheaper than the diagnosis.
   */
  workers: 2,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://127.0.0.1:6106',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // The lane serves the build it is given; `bun run storybook:build` is a CI
    // step before this, so a stale build is a deliberate failure rather than a
    // silent rebuild.
    command: 'bun scripts/serve-workshop.ts 6106',
    url: 'http://127.0.0.1:6106/index.json',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
})
