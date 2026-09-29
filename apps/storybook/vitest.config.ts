import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * The component test lane: every story runs in a real browser through the same
 * preview the workshop serves, with `play` functions exercised for real.
 *
 * This is the lane the Testing module in the sidebar reads, and it complements
 * rather than replaces the Playwright lanes: `test:a11y` and `test:interactions`
 * drive whole pages of the workshop through `@playwright/test`, while this one
 * renders each story in isolation and reports per-story results back into the
 * sidebar. Both run the same story code.
 *
 * Browser mode rather than jsdom: the stories are Solid components rendered by
 * `storybook-solidjs-vite`'s preview, and the primitives measure real layout and
 * real focus — a DOM shim would silently pass what a browser fails.
 */
export default defineConfig({
  plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
