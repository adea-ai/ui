/**
 * Which local checks a set of changed paths makes necessary.
 *
 * `verify-changed.ts` runs the result; this module only decides, so the decision
 * is unit-tested without spawning anything. Two CI gates kept failing pull requests
 * that passed every local command, because nothing local ran them: the registry
 * rebuild-and-diff, and the component shard collection check. Both are cheap, so
 * the rule here is to run them whenever their inputs changed — and to run nothing
 * for code a change cannot reach.
 *
 * Paths are repository-relative and POSIX-separated, as `git diff --name-only`
 * prints them.
 */

import { posix } from 'node:path'

/** A workspace package: its directory and its name for `turbo --filter`. */
export type Workspace = { dir: string; name: string }

/**
 * A directory of bun unit tests and how to run them.
 *
 * `all` is what runs when a change is too widely read to map — the whole suite of
 * that root, which is still only that root.
 */
export type TestRoot = {
  /** Working directory the command runs in, repository-relative. */
  cwd: string
  /** Where its test files live, repository-relative. */
  dir: string
  /** The runner, before any file arguments. */
  command: string[]
  /** Paths whose change makes every test in this root worth running. */
  core: string[]
}

export const TEST_ROOTS: readonly TestRoot[] = [
  {
    cwd: 'packages/ui',
    dir: 'packages/ui/tests',
    command: ['bun', 'test', '--conditions=browser'],
    // Read by nearly every module, or read from disk rather than imported, so an
    // import graph cannot say which tests depend on them.
    core: [
      'packages/ui/src/lib/utils.ts',
      'packages/ui/src/lib/tokens.ts',
      'packages/ui/src/styles/theme.css',
      'packages/ui/src/styles/appearance-font-settings.css',
      'packages/ui/src/styles/appearance-font-settings.css',
      'packages/ui/bunfig.toml',
      'packages/ui/package.json',
      'packages/ui/tests/fixtures/',
      'bunfig.toml',
    ],
  },
  {
    cwd: 'apps/storybook',
    dir: 'apps/storybook/tests/unit',
    command: ['bun', 'test'],
    core: ['apps/storybook/package.json'],
  },
  {
    cwd: '.',
    dir: '.github/scripts',
    command: ['bun', 'test'],
    core: [],
  },
]

/** Inputs of `registry:build`: a change here can change `registry.json` or `public/r`. */
export function affectsRegistry(path: string): boolean {
  return (
    path.startsWith('packages/ui/src/') ||
    path.startsWith('packages/ui/public/r/') ||
    path === 'packages/ui/registry.json' ||
    path === 'packages/ui/package.json' ||
    path === 'packages/ui/cn.config.ts' ||
    /^packages\/ui\/scripts\/(build-registry|registry-core|validate-registry|build-cn-tables|cn-tables-header)[^/]*$/.test(
      path
    )
  )
}

/** Inputs of the component shard collection check in `apps/storybook/scripts`. */
export function affectsComponentShards(path: string): boolean {
  return (
    /^apps\/storybook\/tests\/[^/]+\.spec\.ts$/.test(path) ||
    /^apps\/storybook\/playwright[^/]*\.config\.ts$/.test(path) ||
    path === 'apps/storybook/scripts/check-component-shards.mjs'
  )
}

const TYPED = /\.(ts|tsx|mts|cts)$/
const LINTED = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/

/** A change the type checker reads: TypeScript source, or a tsconfig. */
export function isTypeChecked(path: string): boolean {
  return TYPED.test(path) || /(^|\/)tsconfig[^/]*\.json$/.test(path)
}

/** A file oxlint can lint. Its ignore patterns still apply when it runs. */
export function isLinted(path: string): boolean {
  return LINTED.test(path)
}

/**
 * The workspaces to type-check, or `'all'`.
 *
 * A path belongs to the workspace whose directory contains it. A root tsconfig is
 * extended by every workspace, so it selects all of them. A typed file outside any
 * workspace (the CI helpers in `.github/scripts`) has no typecheck task to run and
 * is reported rather than silently dropped.
 */
export function typecheckTargets(
  paths: string[],
  workspaces: readonly Workspace[]
): { workspaces: string[] | 'all'; uncovered: string[] } {
  const selected = new Set<string>()
  const uncovered: string[] = []
  for (const path of paths.filter(isTypeChecked)) {
    if (/^tsconfig[^/]*\.json$/.test(path)) return { workspaces: 'all', uncovered: [] }
    const owner = workspaces.find((workspace) => path.startsWith(`${workspace.dir}/`))
    if (owner) selected.add(owner.name)
    else uncovered.push(path)
  }
  return { workspaces: [...selected].toSorted(), uncovered }
}

// --- unit tests -------------------------------------------------------------

const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
const RESOLVABLE = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx']

/**
 * Every specifier a module reaches: imports, re-exports, dynamic imports, and
 * string literals that name a relative file (`readFileSync(resolve(dir,
 * '../src/styles/theme.css'))` is how several tests read their subject).
 */
export function specifiersOf(source: string): string[] {
  const found: string[] = []
  const patterns = [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
    /(['"])(\.{1,2}\/[^'"\s]+\.(?:css|json|ts|tsx|mjs|md|toml))\1/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[2] ?? '')
  }
  return [...new Set(found.filter(Boolean))]
}

/**
 * Resolve a specifier from `from` to a known file, or `undefined`.
 *
 * Covers the shapes this repository uses: relative paths, the UI package's private
 * `#lib/*` map, its `@/` alias, and the `@adea-ai/ui` package and subpaths, which
 * resolve to source in development.
 */
export function resolveSpecifier(
  from: string,
  specifier: string,
  files: ReadonlySet<string>
): string | undefined {
  let base: string
  if (specifier.startsWith('.')) base = posix.join(posix.dirname(from), specifier)
  else if (specifier.startsWith('#lib/')) base = `packages/ui/src/lib/${specifier.slice(5)}`
  else if (specifier.startsWith('@/')) base = `packages/ui/src/${specifier.slice(2)}`
  else if (specifier === '@adea-ai/ui') base = 'packages/ui/src/index'
  else if (specifier.startsWith('@adea-ai/ui/')) {
    base = `packages/ui/src/${specifier.slice('@adea-ai/ui/'.length)}`
  } else return undefined
  // A `.js` specifier names the `.ts` file it compiles from.
  const stems = [base, base.replace(/\.js$/, '')]
  for (const stem of stems) {
    for (const suffix of RESOLVABLE) {
      if (files.has(`${stem}${suffix}`)) return `${stem}${suffix}`
    }
  }
  return undefined
}

/**
 * module → the modules that import it.
 *
 * `known` adds paths that resolve without being read — a deleted module is still
 * the target of the imports that will now break.
 */
export function importersGraph(
  sources: ReadonlyMap<string, string>,
  known: Iterable<string> = []
): Map<string, Set<string>> {
  const files = new Set([...sources.keys(), ...known])
  const importers = new Map<string, Set<string>>()
  for (const [file, source] of sources) {
    for (const specifier of specifiersOf(source)) {
      const target = resolveSpecifier(file, specifier, files)
      if (!target || target === file) continue
      const set = importers.get(target) ?? new Set<string>()
      set.add(file)
      importers.set(target, set)
    }
  }
  return importers
}

function isTestFile(path: string, root: TestRoot): boolean {
  return path.startsWith(`${root.dir}/`) && /\.test\.(ts|tsx)$/.test(path)
}

/** Everything that imports `path`, directly or through other modules. */
function transitiveImporters(path: string, importers: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>([path])
  const queue = [path]
  while (queue.length > 0) {
    const next = queue.pop()!
    for (const importer of importers.get(next) ?? []) {
      if (seen.has(importer)) continue
      seen.add(importer)
      queue.push(importer)
    }
  }
  return seen
}

/** What to run in one test root: nothing, the named files, or the whole suite. */
export type TestSelection = { root: TestRoot; files: string[] | 'all'; reason: string }

/**
 * The unit tests a change can affect.
 *
 * A changed test runs. A changed module runs every test that reaches it through
 * imports or a file-path literal. A change to a core file — one nearly every module
 * reads, or one read from disk where no import names it — runs that root's suite,
 * because a mapping that missed a test would be worse than the extra seconds.
 * Stories and MDX are exercised by the Playwright lane, not these runners.
 */
export function selectTests(
  paths: string[],
  sources: ReadonlyMap<string, string>,
  roots: readonly TestRoot[] = TEST_ROOTS
): TestSelection[] {
  const importers = importersGraph(sources, paths)
  const selections: TestSelection[] = []
  for (const root of roots) {
    const core = paths.find((path) =>
      root.core.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry))
    )
    if (core) {
      selections.push({ root, files: 'all', reason: `${core} is read too widely to map` })
      continue
    }
    const files = new Set<string>()
    for (const path of paths) {
      if (/\.stories\.tsx?$|\.mdx$/.test(path)) continue
      for (const reached of transitiveImporters(path, importers)) {
        if (isTestFile(reached, root) && sources.has(reached)) files.add(reached)
      }
    }
    if (files.size > 0) {
      selections.push({
        root,
        files: [...files].toSorted(),
        reason: `${files.size} test file(s) reach the change`,
      })
    }
  }
  return selections
}

/** Whether a path is something the import graph should read. */
export function isGraphSource(path: string): boolean {
  return SOURCE.test(path) && !/(^|\/)node_modules\//.test(path)
}

// --- the plan ---------------------------------------------------------------

export type Plan = {
  /** Changed paths that are registry inputs. */
  registry: string[]
  /** Changed paths that are component shard inputs. */
  componentShards: string[]
  typecheck: { workspaces: string[] | 'all'; uncovered: string[] }
  tests: TestSelection[]
  /** Existing changed files to format-check; oxfmt applies its own ignores. */
  format: string[]
  /** Existing changed files to lint; oxlint applies its own ignores. */
  lint: string[]
}

/**
 * Classify changed paths into the checks they need.
 *
 * `exists` separates deletions, which still select registry, typecheck and test
 * work (deleting a module can break its importers) but cannot be formatted or
 * linted.
 */
export function planChecks(
  paths: string[],
  options: {
    workspaces: readonly Workspace[]
    sources: ReadonlyMap<string, string>
    exists: (path: string) => boolean
    roots?: readonly TestRoot[]
  }
): Plan {
  const unique = [...new Set(paths)].toSorted()
  const present = unique.filter(options.exists)
  return {
    registry: unique.filter(affectsRegistry),
    componentShards: unique.filter(affectsComponentShards),
    typecheck: typecheckTargets(unique, options.workspaces),
    tests: selectTests(unique, options.sources, options.roots),
    format: present,
    lint: present.filter(isLinted),
  }
}
