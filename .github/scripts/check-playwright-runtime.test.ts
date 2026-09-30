import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { validatePlaywrightRuntime } from './check-playwright-runtime.mjs'

const image =
  'mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'
const engines = { chromium: '/engines/chromium', webkit: '/engines/webkit' }

test('matching pinned runtime keeps both engines required', () => {
  expect(() => validatePlaywrightRuntime(image, '1.63.0', engines, () => true)).not.toThrow()
  expect(() =>
    validatePlaywrightRuntime(image, '1.63.0', engines, (path: string) => path !== engines.webkit)
  ).toThrow('webkit executable')
  expect(() => validatePlaywrightRuntime(image, '1.63.0', {}, () => true)).toThrow(
    'chromium executable'
  )
})

test('mismatched dependencies and mutable image tags fail before tests', () => {
  expect(() => validatePlaywrightRuntime(image, '1.64.0', engines, () => true)).toThrow(
    'update the image with the dependency'
  )
  for (const invalid of [undefined, '', 'mcr.microsoft.com/playwright:v1.63.0-noble'])
    expect(() => validatePlaywrightRuntime(invalid, '1.63.0', engines, () => true)).toThrow(
      'digest-pinned'
    )
})

test('PR and publish packed jobs use the pinned engines without installing their OS dependencies', () => {
  for (const file of ['design-system-gates.yml', 'publish-ui.yml']) {
    const workflow = Bun.YAML.parse(
      readFileSync(new URL(`../workflows/${file}`, import.meta.url), 'utf8')
    ) as {
      jobs: Record<
        string,
        {
          container?: { image: string }
          env?: Record<string, string>
          'timeout-minutes': number
          steps: { name?: string; run?: string }[]
        }
      >
    }
    for (const [name, deadline] of [
      ['packed-conversation', 15],
      ['packed-layout', 20],
      ['packed-appearance', 20],
      ['packed-native-select', 15],
    ] as const) {
      const job = workflow.jobs[name]
      expect(job.container?.image).toBe(image)
      expect(job.env?.PLAYWRIGHT_RUNTIME_IMAGE).toBe(image)
      expect(job['timeout-minutes']).toBe(deadline)
      const commands = job.steps.flatMap((step) => (step.run ? [step.run] : []))
      expect(commands.join('\n')).not.toContain('playwright install')
      const guard = commands.indexOf('node .github/scripts/check-playwright-runtime.mjs')
      expect(guard).toBeGreaterThan(-1)
      expect(commands.slice(guard + 1).some((command) => command.includes('check:packed-'))).toBe(
        true
      )
    }
  }
})
