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
    pages: false,
  })
  expect(classifyDesignSystemChanges(['packages/ui/README.md'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
    pages: false,
  })
  expect(classifyDesignSystemChanges(['NOTICE'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
    pages: false,
  })
  expect(classifyDesignSystemChanges(['packages/ui/registry.json'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
    pages: true,
  })
  expect(classifyDesignSystemChanges(['packages/ui/public/r/button.json'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
    pages: true,
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
      pages: true,
    })
  }
})
test('story and component test lanes follow their actual inputs', () => {
  expect(classifyDesignSystemChanges(['apps/storybook/tests/a11y.spec.ts'])).toEqual({
    registry: false,
    workshop: true,
    components: false,
    pages: false,
  })
  expect(
    classifyDesignSystemChanges(['apps/storybook/tests/component-chat-composer.spec.ts'])
  ).toEqual({ registry: false, workshop: false, components: true, pages: false })
  expect(classifyDesignSystemChanges(['apps/storybook/tests/helpers/new-helper.ts'])).toEqual({
    registry: false,
    workshop: true,
    components: true,
    pages: true,
  })
  expect(classifyDesignSystemChanges(['packages/ui/public/r/button.json'])).toEqual({
    registry: true,
    workshop: false,
    components: false,
    pages: true,
  })
})
test('known Storybook Pages-only inputs retain the artifact build without UI or registry suites', () => {
  for (const path of [
    'apps/storybook/.storybook/manager.ts',
    '.github/workflows/registry-pages.yml',
    '.github/scripts/registry-pages.mjs',
    '.github/scripts/registry-pages.test.ts',
  ]) {
    expect(classifyDesignSystemChanges([path])).toEqual({
      registry: false,
      workshop: false,
      components: false,
      pages: true,
    })
  }
  expect(classifyDesignSystemChanges(['.github/scripts/new-pages-helper.mjs'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
    pages: true,
  })
})
test('mixed changes union the needed lanes and unknown paths fail closed', () => {
  expect(
    classifyDesignSystemChanges([
      'README.md',
      'apps/storybook/tests/a11y.spec.ts',
      'packages/ui/public/r/button.json',
    ])
  ).toEqual({ registry: true, workshop: true, components: false, pages: true })
  expect(classifyDesignSystemChanges(['new-build.config.ts'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
    pages: true,
  })
  expect(classifyDesignSystemChanges(['.github/workflows/design-system-gates.yml'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
    pages: true,
  })
})

test('rename paths include removed source when selecting coverage', () => {
  expect(classifyDesignSystemChanges(['packages/ui/src/old.tsx', 'docs/retired.md'])).toEqual({
    registry: true,
    workshop: true,
    components: true,
    pages: true,
  })
})

test('CLI preserves renamed source coverage and falls back on missing immutable refs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'design-system-scope-'))
  const script = new URL('./design-system-changes.mjs', import.meta.url).pathname
  const git = (...args: string[]) =>
    // This disposable tree fixture must not invoke the developer's signing
    // agent or global hooks. Actual repository commits retain their policies.
    execFileSync('git', ['-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: directory,
      encoding: 'utf8',
    }).trim()
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
    const all = 'registry=true\nworkshop=true\ncomponents=true\npages=true\n'
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
    ).toBe('registry=false\nworkshop=false\ncomponents=false\npages=false\n')
    expect(run('push', { before: head, after: docsHead })).toBe(
      'registry=false\nworkshop=false\ncomponents=false\npages=false\n'
    )
    expect(run('push', { before: base, after: head })).toBe(all)
    expect(run('push', { before: base, after: docsHead })).toBe(all)
    for (const event of [
      { before: '0'.repeat(40), after: docsHead },
      { before: head, after: '0'.repeat(40) },
      { before: 'invalid', after: docsHead },
      { before: head },
      { before: 'f'.repeat(40), after: docsHead },
    ])
      expect(run('push', event)).toBe(all)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
  // This integration fixture starts Git and the real CLI repeatedly. Keep its
  // deadline bounded without changing the default for pure classifier tests.
}, 60_000)

test('Release Please version-only metadata keeps Registry qualification and skips UI browser lanes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'design-system-version-only-'))
  const script = new URL('./design-system-changes.mjs', import.meta.url).pathname
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: directory,
      encoding: 'utf8',
    }).trim()
  const run = () => {
    const outputPath = join(directory, 'output.txt')
    writeFileSync(outputPath, '')
    execFileSync(process.execPath, [script], {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: join(directory, 'event.json'),
        GITHUB_OUTPUT: outputPath,
      },
    })
    return readFileSync(outputPath, 'utf8')
  }
  try {
    git('init', '-q')
    git('config', 'user.name', 'Scope fixture')
    git('config', 'user.email', 'scope@example.invalid')
    mkdirSync(join(directory, 'packages/ui'), { recursive: true })
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'adea-ui',
        version: '0.68.1',
        private: true,
        scripts: { test: 'bun test' },
      })
    )
    writeFileSync(
      join(directory, 'packages/ui/package.json'),
      JSON.stringify({ name: '@adea-ai/ui', version: '0.68.1', exports: { '.': './src/index.ts' } })
    )
    writeFileSync(
      join(directory, '.release-please-manifest.json'),
      JSON.stringify({ '.': '0.68.1' })
    )
    writeFileSync(join(directory, 'CHANGELOG.md'), '# Changelog\n\n## 0.68.1\n')
    git('add', '.')
    git('commit', '-qm', 'fixture base')
    const base = git('rev-parse', 'HEAD')

    const rootPackagePath = join(directory, 'package.json')
    const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'))
    rootPackage.version = '0.68.2'
    writeFileSync(rootPackagePath, JSON.stringify(rootPackage))
    const uiPackagePath = join(directory, 'packages/ui/package.json')
    const uiPackage = JSON.parse(readFileSync(uiPackagePath, 'utf8'))
    uiPackage.version = '0.68.2'
    writeFileSync(uiPackagePath, JSON.stringify(uiPackage))
    writeFileSync(
      join(directory, '.release-please-manifest.json'),
      JSON.stringify({ '.': '0.68.2' })
    )
    writeFileSync(join(directory, 'CHANGELOG.md'), '# Changelog\n\n## 0.68.2\n')
    git('add', '.')
    git('commit', '-qm', 'fixture version-only release')
    const release = git('rev-parse', 'HEAD')
    writeFileSync(
      join(directory, 'event.json'),
      JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: release } } })
    )
    expect(run()).toBe('registry=true\nworkshop=false\ncomponents=false\npages=false\n')
    writeFileSync(join(directory, 'event.json'), JSON.stringify({ before: base, after: release }))
    const pushOutputPath = join(directory, 'push-output.txt')
    writeFileSync(pushOutputPath, '')
    execFileSync(process.execPath, [script], {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: 'push',
        GITHUB_EVENT_PATH: join(directory, 'event.json'),
        GITHUB_OUTPUT: pushOutputPath,
      },
    })
    expect(readFileSync(pushOutputPath, 'utf8')).toBe(
      'registry=true\nworkshop=false\ncomponents=false\npages=false\n'
    )

    uiPackage.exports = { '.': './src/index.ts', './button': './src/components/button.tsx' }
    writeFileSync(uiPackagePath, JSON.stringify(uiPackage))
    git('add', '.')
    git('commit', '-qm', 'fixture package export change')
    const contract = git('rev-parse', 'HEAD')
    writeFileSync(
      join(directory, 'event.json'),
      JSON.stringify({ pull_request: { base: { sha: release }, head: { sha: contract } } })
    )
    expect(run()).toBe('registry=true\nworkshop=true\ncomponents=true\npages=true\n')
    writeFileSync(
      join(directory, 'event.json'),
      JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: contract } } })
    )
    expect(run()).toBe('registry=true\nworkshop=true\ncomponents=true\npages=true\n')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}, 30_000)

test('the actual aggregate gate rejects failed, cancelled, missing and required skipped lanes', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(new URL('../workflows/design-system-gates.yml', import.meta.url), 'utf8')
  ) as {
    jobs: Record<string, { steps: { env?: Record<string, string>; run: string }[] }>
  }
  const script = workflow.jobs['workshop-gate'].steps[0].run
  expect(workflow.jobs['workshop-gate'].steps[0].env?.PAGES_NEEDED).toContain(
    'needs.changes.outputs.pages'
  )
  const defaults = {
    SCOPE_RESULT: 'success',
    WORKSHOP_NEEDED: 'true',
    PAGES_NEEDED: 'false',
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
  expect(
    passes({
      WORKSHOP_NEEDED: 'false',
      BUILD_RESULT: 'success',
      STORIES_RESULT: 'skipped',
    })
  ).toBe(true)
  expect(
    passes({
      WORKSHOP_NEEDED: 'false',
      PAGES_NEEDED: 'true',
      BUILD_RESULT: 'success',
      STORIES_RESULT: 'skipped',
      COMPONENTS_NEEDED: 'false',
      COMPONENTS_RESULT: 'skipped',
    })
  ).toBe(true)
  expect(
    passes({
      WORKSHOP_NEEDED: 'false',
      PAGES_NEEDED: 'true',
      BUILD_RESULT: 'skipped',
      STORIES_RESULT: 'skipped',
      COMPONENTS_NEEDED: 'false',
      COMPONENTS_RESULT: 'skipped',
    })
  ).toBe(false)
  expect(passes({ COMPONENTS_NEEDED: 'false', COMPONENTS_RESULT: 'skipped' })).toBe(true)
  expect(
    passes({ WORKSHOP_NEEDED: 'false', BUILD_RESULT: 'failure', STORIES_RESULT: 'skipped' })
  ).toBe(false)
  expect(passes({ COMPONENTS_NEEDED: 'false', COMPONENTS_RESULT: 'cancelled' })).toBe(false)
})

test('Pages publishes the exact successful main build and keeps registry install routes', () => {
  const gates = Bun.YAML.parse(
    readFileSync(new URL('../workflows/design-system-gates.yml', import.meta.url), 'utf8')
  ) as {
    jobs: Record<
      string,
      {
        if?: string
        outputs?: Record<string, string>
        steps?: { env?: Record<string, string> }[]
      }
    >
  }
  expect(gates.jobs['changes'].outputs?.pages).toContain('steps.scope.outputs.pages')
  expect(gates.jobs['workshop-build'].if).toContain("needs.changes.outputs.pages != 'false'")
  expect(gates.jobs['workshop-build'].if).not.toContain("github.event_name == 'push'")
  expect(gates.jobs['workshop'].if).toContain("needs.changes.outputs.workshop != 'false'")
  expect(gates.jobs['components'].if).toContain("needs.changes.outputs.components != 'false'")
  expect(gates.jobs['registry'].if).toContain("needs.changes.outputs.registry != 'false'")
  expect(gates.jobs['workshop-gate'].steps?.[0].env?.PAGES_NEEDED).toContain(
    'needs.changes.outputs.pages'
  )

  const pages = Bun.YAML.parse(
    readFileSync(new URL('../workflows/registry-pages.yml', import.meta.url), 'utf8')
  ) as {
    on: { workflow_run: { workflows: string[]; types: string[] }; workflow_dispatch: unknown }
    jobs: Record<
      string,
      {
        if?: string
        steps: {
          name: string
          run?: string
          uses?: string
          with?: Record<string, string | boolean>
        }[]
      }
    >
  }
  expect(pages.on.workflow_run).toEqual({
    workflows: ['Design System Gates'],
    types: ['completed'],
  })
  expect(Object.hasOwn(pages.on, 'workflow_dispatch')).toBe(true)
  expect(pages.jobs['prepare'].if).toContain(
    'github.event.workflow_run.head_repository.full_name == github.repository'
  )
  const steps = pages.jobs['prepare'].steps
  const helperCheckoutIndex = steps.findIndex(
    (step) => step.name === 'Checkout trusted main for workflow scripts'
  )
  const guardIndex = steps.findIndex((step) => step.name.includes('freshness'))
  const sourceCheckoutIndex = steps.findIndex(
    (step) => step.name === 'Checkout the exact source revision'
  )
  const helperCheckout = steps[helperCheckoutIndex]
  const sourceCheckout = steps[sourceCheckoutIndex]
  expect(helperCheckout?.uses).toBe('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1')
  expect(helperCheckout?.with?.ref).toBe('refs/heads/main')
  expect(helperCheckout?.with?.['persist-credentials']).toBe(false)
  expect(helperCheckoutIndex).toBeGreaterThanOrEqual(0)
  expect(helperCheckoutIndex).toBeLessThan(guardIndex)
  expect(guardIndex).toBeLessThan(sourceCheckoutIndex)
  expect(sourceCheckout?.if).toBe("steps.guard.outputs.publish == 'true'")
  expect(sourceCheckout?.with?.ref).toBe('${{ steps.guard.outputs.head_sha }}')
  const guard = steps[guardIndex]?.run
  expect(guard).toBe('node .github/scripts/registry-pages.mjs')
  const currentMainBuild = pages.jobs['prepare'].steps.find((step) =>
    step.name.includes('Build Storybook')
  )
  expect(currentMainBuild?.if).toContain("steps.guard.outputs.source == 'current-main'")
  expect(currentMainBuild?.run).toBe('bun run storybook:build')
  const download = pages.jobs['prepare'].steps.find((step) => step.name.includes('this run'))
  expect(download?.with?.name).toBe('storybook-static')
  expect(download?.with?.['run-id']).toContain('github.event.workflow_run.id')
  expect(download?.if).toContain("steps.guard.outputs.source == 'workflow_run'")
  const assembly = pages.jobs['prepare'].steps.find((step) => step.name.includes('Assemble'))?.run
  expect(assembly).toContain('storybook-static/. _site/')
  expect(assembly).toContain('packages/ui/public/r/. _site/r/')
  expect(pages.jobs['deploy'].if).toContain("needs.prepare.outputs.publish == 'true'")

  const registryPage = readFileSync(
    new URL('../../apps/storybook/styleguide/registry-index.html', import.meta.url),
    'utf8'
  )
  expect(registryPage).toContain('href="../r/registry.json"')
  expect(registryPage).toContain('href="../r/theme.json"')
  expect(registryPage).toContain('href="../"')
  expect(registryPage).toContain('Return to Adea UI Storybook')
  const managerConfig = readFileSync(
    new URL('../../apps/storybook/.storybook/manager.ts', import.meta.url),
    'utf8'
  )
  expect(managerConfig).toContain("brandTitle: 'Adea UI — Storybook'")
})
