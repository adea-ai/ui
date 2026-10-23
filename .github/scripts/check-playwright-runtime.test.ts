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
      ['packed-layout', 15],
      ['packed-layout-renderer', 20],
      ['packed-appearance', 20],
      ['packed-modal-dialog', 15],
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

test('component shards use the pinned runtime before collection and interactions', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(new URL('../workflows/design-system-gates.yml', import.meta.url), 'utf8')
  ) as {
    jobs: {
      components: {
        container?: { image: string }
        env?: Record<string, string>
        'timeout-minutes': number
        strategy: { 'fail-fast': boolean; matrix: { shard: string[] } }
        steps: { name?: string; run?: string; uses?: string; if?: string }[]
      }
    }
  }
  const job = workflow.jobs.components
  expect(job.container?.image).toBe(image)
  expect(job.env?.PLAYWRIGHT_RUNTIME_IMAGE).toBe(image)
  expect(job.env?.PLAYWRIGHT_BROWSERS_PATH).toBeUndefined()
  expect(job['timeout-minutes']).toBe(20)
  expect(job.strategy['fail-fast']).toBe(false)
  expect(job.strategy.matrix.shard).toEqual(['1/6', '2/6', '3/6', '4/6', '5/6', '6/6'])

  const commands = job.steps.flatMap((step) => (step.run ? [step.run] : []))
  expect(commands).toContain('bun install --frozen-lockfile')
  expect(commands.join('\n')).not.toContain('playwright install')
  expect(job.steps.some((step) => step.uses?.startsWith('actions/cache@'))).toBe(false)
  const bootstrap = job.steps.findIndex(
    (step) => step.run === 'apt-get update && apt-get install -y --no-install-recommends unzip'
  )
  const setupBun = job.steps.findIndex((step) => step.uses?.startsWith('oven-sh/setup-bun@'))
  expect(bootstrap).toBeGreaterThan(-1)
  expect(setupBun).toBeGreaterThan(bootstrap)

  const guard = commands.indexOf('node .github/scripts/check-playwright-runtime.mjs')
  const collection = 'bun scripts/check-component-shards.mjs'
  const interactions = 'bun run test:components --shard=${{ matrix.shard }}'
  expect(guard).toBeGreaterThan(-1)
  expect(commands.indexOf(collection)).toBeGreaterThan(guard)
  expect(commands.indexOf(interactions)).toBeGreaterThan(guard)
  expect(job.steps.find((step) => step.run === collection)?.if).toBe("matrix.shard == '1/6'")
})
