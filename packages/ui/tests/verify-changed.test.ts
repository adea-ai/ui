import { describe, expect, test } from 'bun:test'
import {
  affectsComponentShards,
  affectsRegistry,
  importersGraph,
  isGraphSource,
  isLinted,
  isTypeChecked,
  planChecks,
  resolveSpecifier,
  selectTests,
  specifiersOf,
  TEST_ROOTS,
  typecheckTargets,
  type Workspace,
} from '../scripts/verify-changed-plan'

/**
 * `verify:changed` exists because two CI gates failed pull requests that passed
 * every local command. These pin the path → check mapping, so a change that should
 * run a gate cannot quietly stop selecting it — and one that cannot reach a check
 * does not pay for it.
 */

const workspaces: Workspace[] = [
  { dir: 'apps/storybook', name: '@adea-ai/storybook' },
  { dir: 'packages/ui', name: '@adea-ai/ui' },
]

describe('registry selection', () => {
  test('selects any library source and the registry scripts', () => {
    for (const path of [
      'packages/ui/src/components/ui/button/button.tsx',
      'packages/ui/src/styles/globals.css',
      'packages/ui/scripts/build-registry.ts',
      'packages/ui/scripts/registry-core.ts',
      'packages/ui/scripts/validate-registry.ts',
      'packages/ui/registry.json',
      'packages/ui/public/r/button.json',
      'packages/ui/package.json',
    ]) {
      expect(affectsRegistry(path), path).toBe(true)
    }
  })

  test('ignores what the registry build cannot read', () => {
    for (const path of [
      'packages/ui/tests/registry.test.ts',
      'packages/ui/scripts/check-pack.ts',
      'apps/storybook/tests/a11y.spec.ts',
      'AGENTS.md',
    ]) {
      expect(affectsRegistry(path), path).toBe(false)
    }
  })
})

describe('component shard selection', () => {
  test('selects specs, Playwright configs and the checker itself', () => {
    for (const path of [
      'apps/storybook/tests/component-tooltip.spec.ts',
      'apps/storybook/playwright.components.config.ts',
      'apps/storybook/playwright.config.ts',
      'apps/storybook/scripts/check-component-shards.mjs',
    ]) {
      expect(affectsComponentShards(path), path).toBe(true)
    }
  })

  test('ignores spec helpers, unit tests and the library', () => {
    for (const path of [
      'apps/storybook/tests/stories.ts',
      'apps/storybook/tests/unit/component-metadata.test.ts',
      'packages/ui/src/components/ui/tooltip/tooltip.tsx',
    ]) {
      expect(affectsComponentShards(path), path).toBe(false)
    }
  })
})

describe('typecheck selection', () => {
  test('selects the workspace that owns a TypeScript change', () => {
    expect(
      typecheckTargets(
        ['packages/ui/src/lib/hover.ts', 'packages/ui/src/styles/theme.css', 'README.md'],
        workspaces
      )
    ).toEqual({ workspaces: ['@adea-ai/ui'], uncovered: [] })
    expect(
      typecheckTargets(['apps/storybook/tsconfig.layout.json', 'packages/ui/x.tsx'], workspaces)
    ).toEqual({ workspaces: ['@adea-ai/storybook', '@adea-ai/ui'], uncovered: [] })
  })

  test('a root tsconfig selects every workspace', () => {
    expect(typecheckTargets(['tsconfig.json'], workspaces)).toEqual({
      workspaces: 'all',
      uncovered: [],
    })
  })

  test('reports typed files no workspace checks, and selects nothing for none', () => {
    expect(typecheckTargets(['.github/scripts/registry-pages.test.ts'], workspaces)).toEqual({
      workspaces: [],
      uncovered: ['.github/scripts/registry-pages.test.ts'],
    })
    expect(typecheckTargets(['docs/conventions.md'], workspaces)).toEqual({
      workspaces: [],
      uncovered: [],
    })
  })

  test('classifies file kinds', () => {
    expect(isTypeChecked('a/b.mts')).toBe(true)
    expect(isTypeChecked('a/b.mjs')).toBe(false)
    expect(isLinted('a/b.mjs')).toBe(true)
    expect(isLinted('a/b.css')).toBe(false)
    expect(isGraphSource('packages/ui/src/index.ts')).toBe(true)
    expect(isGraphSource('node_modules/x/index.js')).toBe(false)
    expect(isGraphSource('packages/ui/src/styles/theme.css')).toBe(false)
  })
})

describe('import resolution', () => {
  const files = new Set([
    'packages/ui/src/index.ts',
    'packages/ui/src/lib/hover.ts',
    'packages/ui/src/components/ui/button/index.ts',
    'packages/ui/src/components/ui/button/button.tsx',
    'packages/ui/scripts/registry-core.ts',
    'packages/ui/src/styles/theme.css',
  ])

  test('reads imports, re-exports, dynamic imports and relative file literals', () => {
    expect(
      specifiersOf(`
        import { a } from './a'
        import type { B } from "../b"
        export * from './c'
        import './side-effect.css'
        const d = await import('./d')
        const css = readFileSync(resolve(dir, '../src/styles/theme.css'), 'utf8')
        const ignored = 'not/a/relative/path.ts'
      `).toSorted()
    ).toEqual(
      ['../b', '../src/styles/theme.css', './a', './c', './d', './side-effect.css'].toSorted()
    )
  })

  test('resolves the specifier shapes the repository uses', () => {
    const from = 'packages/ui/src/components/ui/button/button.tsx'
    expect(resolveSpecifier(from, '#lib/hover', files)).toBe('packages/ui/src/lib/hover.ts')
    expect(resolveSpecifier(from, '@/lib/hover', files)).toBe('packages/ui/src/lib/hover.ts')
    expect(resolveSpecifier(from, '../../../lib/hover.js', files)).toBe(
      'packages/ui/src/lib/hover.ts'
    )
    expect(resolveSpecifier('apps/storybook/tests/x.ts', '@adea-ai/ui', files)).toBe(
      'packages/ui/src/index.ts'
    )
    expect(
      resolveSpecifier('apps/storybook/tests/x.ts', '@adea-ai/ui/components/ui/button', files)
    ).toBe('packages/ui/src/components/ui/button/index.ts')
    expect(resolveSpecifier('packages/ui/tests/x.test.ts', '../scripts/registry-core', files)).toBe(
      'packages/ui/scripts/registry-core.ts'
    )
    expect(resolveSpecifier(from, 'solid-js', files)).toBeUndefined()
    expect(resolveSpecifier(from, './missing', files)).toBeUndefined()
  })

  test('builds an importer graph without self-edges', () => {
    const graph = importersGraph(
      new Map([
        ['packages/ui/src/a.ts', "import './b'\nexport * from './a'"],
        ['packages/ui/src/b.ts', ''],
      ])
    )
    expect([...(graph.get('packages/ui/src/b.ts') ?? [])]).toEqual(['packages/ui/src/a.ts'])
    expect(graph.has('packages/ui/src/a.ts')).toBe(false)
  })
})

describe('unit test selection', () => {
  const sources = new Map([
    ['packages/ui/src/lib/hover.ts', "import { cn } from './utils'"],
    ['packages/ui/src/lib/utils.ts', ''],
    ['packages/ui/src/components/ui/menu/menu.tsx', "import { hover } from '#lib/hover'"],
    ['packages/ui/src/components/ui/menu/index.ts', "export * from './menu'"],
    ['packages/ui/src/components/ui/menu/menu.stories.tsx', "import { Menu } from '.'"],
    ['packages/ui/tests/hover.test.ts', "import { hover } from '../src/lib/hover'"],
    ['packages/ui/tests/menu.test.ts', "import { Menu } from '../src/components/ui/menu'"],
    ['packages/ui/tests/split.test.ts', "import { split } from '../src/lib/split'"],
    ['packages/ui/tests/css.test.ts', "readFileSync(join(dir, '../src/styles/globals.css'))"],
    ['apps/storybook/tests/unit/meta.test.ts', "import { Menu } from '@adea-ai/ui'"],
    ['packages/ui/src/index.ts', "export * from './components/ui/menu'"],
    ['.github/scripts/pages.mjs', ''],
    ['.github/scripts/pages.test.ts', "import { pages } from './pages.mjs'"],
  ])
  const selected = (paths: string[]) =>
    selectTests(paths, sources).map(({ root, files }) => [root.dir, files])

  test('runs the tests that reach a module directly or transitively, across roots', () => {
    expect(selected(['packages/ui/src/lib/hover.ts'])).toEqual([
      ['packages/ui/tests', ['packages/ui/tests/hover.test.ts', 'packages/ui/tests/menu.test.ts']],
      ['apps/storybook/tests/unit', ['apps/storybook/tests/unit/meta.test.ts']],
    ])
  })

  test('runs a changed test, and a test that reads a changed file by path', () => {
    expect(
      selected(['packages/ui/tests/split.test.ts', 'packages/ui/src/styles/globals.css'])
    ).toEqual([
      ['packages/ui/tests', ['packages/ui/tests/css.test.ts', 'packages/ui/tests/split.test.ts']],
    ])
    expect(selected(['.github/scripts/pages.mjs'])).toEqual([
      ['.github/scripts', ['.github/scripts/pages.test.ts']],
    ])
  })

  test('still maps a deleted module to the tests that imported it', () => {
    expect(selected(['packages/ui/src/lib/split.ts'])).toEqual([
      ['packages/ui/tests', ['packages/ui/tests/split.test.ts']],
    ])
  })

  test('a core file runs only its own root whole', () => {
    const [ui, ...rest] = selectTests(['packages/ui/src/lib/utils.ts'], sources)
    expect(ui?.root.dir).toBe('packages/ui/tests')
    expect(ui?.files).toBe('all')
    expect(ui?.reason).toContain('packages/ui/src/lib/utils.ts')
    // utils is imported by hover, so the storybook test is still reached by import.
    expect(rest.map(({ root, files }) => [root.dir, files])).toEqual([
      ['apps/storybook/tests/unit', ['apps/storybook/tests/unit/meta.test.ts']],
    ])
    expect(selectTests(['packages/ui/tests/fixtures/theme.json'], sources)[0]?.files).toBe('all')
  })

  test('stories, docs and unreached modules select nothing', () => {
    expect(
      selected([
        'packages/ui/src/components/ui/menu/menu.stories.tsx',
        'packages/ui/src/components/ui/menu/menu.mdx',
        'docs/conventions.md',
      ])
    ).toEqual([])
  })

  test('every root names a runner and a directory', () => {
    for (const root of TEST_ROOTS) {
      expect(root.command[0]).toBe('bun')
      expect(root.dir.length).toBeGreaterThan(0)
    }
  })
})

describe('the plan', () => {
  test('deletions select checks but are not formatted or linted', () => {
    const plan = planChecks(
      [
        'packages/ui/src/components/ui/menu/menu.tsx',
        'packages/ui/src/components/ui/old/old.tsx',
        'apps/storybook/tests/component-menu.spec.ts',
        'AGENTS.md',
        'AGENTS.md',
      ],
      {
        workspaces,
        sources: new Map(),
        exists: (path) => !path.includes('/old/'),
      }
    )
    expect(plan.registry).toEqual([
      'packages/ui/src/components/ui/menu/menu.tsx',
      'packages/ui/src/components/ui/old/old.tsx',
    ])
    expect(plan.componentShards).toEqual(['apps/storybook/tests/component-menu.spec.ts'])
    expect(plan.typecheck.workspaces).toEqual(['@adea-ai/storybook', '@adea-ai/ui'])
    expect(plan.format).toEqual([
      'AGENTS.md',
      'apps/storybook/tests/component-menu.spec.ts',
      'packages/ui/src/components/ui/menu/menu.tsx',
    ])
    expect(plan.lint).toEqual([
      'apps/storybook/tests/component-menu.spec.ts',
      'packages/ui/src/components/ui/menu/menu.tsx',
    ])
    expect(plan.tests).toEqual([])
  })

  test('a documentation-only change selects only formatting', () => {
    const plan = planChecks(['README.md', 'docs/conventions.md'], {
      workspaces,
      sources: new Map(),
      exists: () => true,
    })
    expect(plan).toEqual({
      registry: [],
      componentShards: [],
      typecheck: { workspaces: [], uncovered: [] },
      tests: [],
      format: ['README.md', 'docs/conventions.md'],
      lint: [],
    })
  })
})
