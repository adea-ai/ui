import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/design-system-gates.yml'),
  'utf8'
)
const componentConfig = readFileSync(
  resolve(repositoryRoot, 'apps/storybook/playwright.components.config.ts'),
  'utf8'
)
const storyConfig = readFileSync(
  resolve(repositoryRoot, 'apps/storybook/playwright.config.ts'),
  'utf8'
)
const contributing = readFileSync(resolve(repositoryRoot, 'CONTRIBUTING.md'), 'utf8')
const changesJob = section(workflow, '\n  changes:\n', '\n  registry-core:\n')

function section(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start)
  const endAt = source.indexOf(end, startAt + start.length)
  if (startAt < 0 || endAt < 0) throw new Error(`Could not find workflow section ${start}.`)
  return source.slice(startAt, endAt)
}

const componentsJob = section(workflow, '\n  components:\n', '\n  workshop-gate:\n')
const reportUploadStart = componentsJob.indexOf('- name: Upload component report')
if (reportUploadStart < 0) throw new Error('Could not find component report upload step.')
const reportUpload = componentsJob.slice(reportUploadStart)
const workshopGateStart = workflow.indexOf('\n  workshop-gate:\n')
if (workshopGateStart < 0) throw new Error('Could not find workflow section workshop-gate.')
const workshopGate = workflow.slice(workshopGateStart)

test('component browser contracts partition the complete Playwright suite into six shards', () => {
  expect(changesJob).toContain('component-shards.test.ts')
  expect(componentsJob).toContain("shard: ['1/6', '2/6', '3/6', '4/6', '5/6', '6/6']")
  expect(componentsJob).toContain('fail-fast: false')
  expect(componentsJob).toContain('run: bun run test:components --shard=${{ matrix.shard }}')
  expect(componentsJob).toContain("if: matrix.shard == '1/6'")
  expect(componentsJob).toContain('run: bun scripts/check-component-shards.mjs')
  expect(reportUpload).toContain('if: always()')
  expect(reportUpload).toContain('name: component-interactions-report-${{ strategy.job-index }}')
  expect(reportUpload).toContain('path: apps/storybook/test-results/')
  expect(componentsJob).not.toContain('continue-on-error: true')

  expect(componentConfig).toContain("testMatch: 'component-*.spec.ts'")
  expect(componentConfig).toContain('fullyParallel: false')
  expect(componentConfig).toContain('workers: 1')
  expect(componentConfig).toContain("retries: process.env['CI'] ? 2 : 0")
  expect(componentConfig).toContain('timeout: 90_000')
  expect(componentConfig).toContain('expect: { timeout: 10_000 }')
  expect(componentConfig).toContain("name: 'chromium'")
  expect(componentConfig).toContain("name: 'webkit'")
  expect(storyConfig).toContain("testIgnore: ['**/unit/**', '**/component-*.spec.ts']")
})

test('the stable Workshop gate still requires every component shard to succeed', () => {
  expect(workshopGate).toContain('needs: [changes, workshop-build, workshop, components]')
  expect(workshopGate).toContain('COMPONENTS_RESULT: ${{ needs.components.result }}')
  expect(workshopGate).toContain(
    'if [ "$SCOPE_RESULT" = success ] && [ "$COMPONENTS_NEEDED" = false ] && [ "$COMPONENTS_RESULT" = skipped ]; then'
  )
  expect(workshopGate).toContain(
    '[ "$BUILD_RESULT" != success ] || [ "$STORIES_RESULT" != success ] || [ "$COMPONENTS_RESULT" != success ]'
  )
  expect(workshopGate).toContain('BUILD_RESULT')
  expect(workshopGate).toContain('STORIES_RESULT')
  expect(contributing).toContain('suite runs in six Playwright shards across Chromium and WebKit')
  expect(contributing).toMatch(/every story shard and every\s+component shard succeed/)
})
