import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyDesignSystemChanges } from './design-system-changes.mjs'

test('documentation skips expensive gates, but distribution notices do not', () => {
  expect(classifyDesignSystemChanges(['README.md', 'docs/conventions.md'])).toEqual({
    registry: false,
    workshop: false,
    components: false,
  })
  expect(classifyDesignSystemChanges(['packages/ui/README.md'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
  })
  expect(classifyDesignSystemChanges(['NOTICE'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
  })
})
test('rendering, tokens and dependencies retain complete coverage', () => {
  for (const path of [
    'packages/ui/src/components/ui/button/button.tsx',
    'packages/ui/src/styles/theme.css',
    'bun.lock',
    'packages/ui/package.json',
  ]) {
    expect(classifyDesignSystemChanges([path])).toEqual({
      registry: true,
      workshop: true,
      components: true,
    })
  }
})
test('story and component test lanes follow their actual inputs', () => {
  expect(classifyDesignSystemChanges(['apps/storybook/tests/a11y.spec.ts'])).toEqual({
    registry: false,
    workshop: true,
    components: false,
  })
  expect(
    classifyDesignSystemChanges(['apps/storybook/tests/component-chat-composer.spec.ts'])
  ).toEqual({ registry: false, workshop: false, components: true })
  expect(classifyDesignSystemChanges(['apps/storybook/tests/helpers/new-helper.ts'])).toEqual({
    registry: false,
    workshop: true,
    components: true,
  })
  expect(classifyDesignSystemChanges(['packages/ui/public/r/button.json'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
  })
})
test('mixed changes union the needed lanes and unknown paths fail closed', () => {
  expect(
    classifyDesignSystemChanges([
      'README.md',
      'apps/storybook/tests/a11y.spec.ts',
      'packages/ui/public/r/button.json',
    ])
  ).toEqual({ registry: true, workshop: true, components: false })
  expect(classifyDesignSystemChanges(['new-build.config.ts'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
  })
  expect(classifyDesignSystemChanges(['.github/workflows/design-system-gates.yml'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
  })
})

test('rename paths include removed source when selecting coverage', () => {
  expect(classifyDesignSystemChanges(['packages/ui/src/old.tsx', 'docs/retired.md'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
  })
})

test('CLI preserves renamed source coverage and falls back on missing immutable refs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'design-system-scope-'))
  const script = new URL('./design-system-changes.mjs', import.meta.url).pathname
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
  const run = (eventName: string, event: object) => {
    const eventPath = join(directory, 'event.json')
    const outputPath = join(directory, 'output.txt')
    writeFileSync(eventPath, JSON.stringify(event))
    writeFileSync(outputPath, '')
    execFileSync(process.execPath, [script], {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outputPath,
      },
    })
    return readFileSync(outputPath, 'utf8')
  }
  try {
    git('init', '-q')
    git('config', 'user.name', 'Scope fixture')
    git('config', 'user.email', 'scope@example.invalid')
    mkdirSync(join(directory, 'packages/ui/src'), { recursive: true })
    writeFileSync(join(directory, 'packages/ui/src/old.tsx'), 'source fixture\n')
    git('add', '.')
    git('commit', '-qm', 'fixture base')
    const base = git('rev-parse', 'HEAD')
    mkdirSync(join(directory, 'docs'))
    git('mv', 'packages/ui/src/old.tsx', 'docs/retired.md')
    git('commit', '-qm', 'fixture rename')
    const head = git('rev-parse', 'HEAD')
    const all = 'registry=true\nworkshop=true\ncomponents=true\n'
    expect(
      run('pull_request', { pull_request: { base: { sha: base }, head: { sha: head } } })
    ).toBe(all)
    expect(run('pull_request', {})).toBe(all)
    expect(run('push', {})).toBe(all)
    writeFileSync(join(directory, 'docs/retired.md'), 'documentation change\n')
    git('add', 'docs/retired.md')
    git('commit', '-qm', 'fixture docs')
    const docsHead = git('rev-parse', 'HEAD')
    expect(
      run('pull_request', { pull_request: { base: { sha: head }, head: { sha: docsHead } } })
    ).toBe('registry=false\nworkshop=false\ncomponents=false\n')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the actual aggregate gate rejects failed, cancelled, missing and required skipped lanes', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(new URL('../workflows/design-system-gates.yml', import.meta.url), 'utf8')
  ) as { jobs: Record<string, { steps: { run: string }[] }> }
  const script = workflow.jobs['workshop-gate'].steps[0].run
  const defaults = {
    SCOPE_RESULT: 'success',
    WORKSHOP_NEEDED: 'true',
    COMPONENTS_NEEDED: 'true',
    BUILD_RESULT: 'success',
    STORIES_RESULT: 'success',
    COMPONENTS_RESULT: 'success',
  }
  const passes = (overrides: Record<string, string>) =>
    Bun.spawnSync(['bash', '-c', script], {
      env: { ...process.env, ...defaults, ...overrides },
    }).exitCode === 0
  expect(passes({})).toBe(true)
  for (const key of ['SCOPE_RESULT', 'BUILD_RESULT', 'STORIES_RESULT', 'COMPONENTS_RESULT']) {
    for (const value of ['failure', 'cancelled', 'skipped', '']) {
      expect(passes({ [key]: value })).toBe(false)
    }
  }
  expect(
    passes({
      WORKSHOP_NEEDED: 'false',
      BUILD_RESULT: 'skipped',
      STORIES_RESULT: 'skipped',
    })
  ).toBe(true)
  expect(passes({ COMPONENTS_NEEDED: 'false', COMPONENTS_RESULT: 'skipped' })).toBe(true)
  expect(
    passes({ WORKSHOP_NEEDED: 'false', BUILD_RESULT: 'failure', STORIES_RESULT: 'skipped' })
  ).toBe(false)
  expect(passes({ COMPONENTS_NEEDED: 'false', COMPONENTS_RESULT: 'cancelled' })).toBe(false)
})
