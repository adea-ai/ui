/**
 * What the package `exports` map promises, expanded into concrete modules.
 *
 * Two consumers share this so they cannot disagree:
 *
 *   - `vite.config.ts` builds one library entry per published module. With
 *     `preserveModules`, Rollup tree-shakes a module's exports down to what the
 *     entries and other modules actually use *unless the module is itself an
 *     entry*. A module that is published through the `exports` map but is not an
 *     entry therefore ships with only the exports some other bundled module
 *     happened to import, while its `.d.ts` still declares all of them. The map
 *     is the source of truth, so the entries are derived from it.
 *   - `check-lib-exports.ts` and its test compare every expanded module's built
 *     runtime exports with the exports its declaration file lists.
 *
 * Pure: no filesystem access, so the expansion is unit-tested directly.
 */

type Conditions = Record<string, string>
export type ExportsMap = Record<string, string | Conditions | null>

/** One published module: the specifier a consumer writes and the files behind it. */
export type PublishedModule = {
  /** e.g. `@adea-ai/ui/lib/themes` (the package name is not included: `./lib/themes`). */
  specifier: string
  /** Declaration file, package-relative, e.g. `dist/lib/themes.d.ts`. */
  types: string
  /** Compiled module, package-relative, e.g. `dist/lib/themes.js`. */
  runtime: string
  /** Source module, package-relative, e.g. `src/lib/themes.ts`; absent when no source condition. */
  source?: string
  /** The library entry name Rollup writes it under, e.g. `lib/themes`. */
  entry: string
}

const SOURCE_FILE = /\.(ts|tsx)$/
const REVIEW_SURFACE = /\.(stories|test)\.|\.mdx$/

/** Package-relative source files that can back a wildcard export. */
function isPublishableSource(file: string): boolean {
  return SOURCE_FILE.test(file) && !REVIEW_SURFACE.test(file) && !file.endsWith('.d.ts')
}

const stripDot = (path: string) => path.replace(/^\.\//, '')

/**
 * Every module the `exports` map publishes with a compiled runtime and a
 * declaration file.
 *
 * `sourceFiles` are paths relative to `src/` (POSIX). A wildcard pattern expands
 * against them using its `solid` source condition: `./lib/*` maps `*` to each
 * `lib/<name>.ts`, `./components/*` to each `components/<name>/index.ts`. A
 * subpath explicitly set to `null` is a deliberate block (the generated tables)
 * and is not expanded.
 */
export function publishedModules(
  exports: ExportsMap,
  sourceFiles: readonly string[]
): PublishedModule[] {
  const modules: PublishedModule[] = []
  const blocked = new Set(
    Object.entries(exports)
      .filter(([, value]) => value === null)
      .map(([specifier]) => specifier)
  )
  const sources = sourceFiles.filter(isPublishableSource)

  for (const [specifier, value] of Object.entries(exports)) {
    if (value === null || typeof value === 'string') continue
    const types = value.types
    const runtime = value.import ?? value.default
    const source = value.solid
    if (!types || !runtime || !types.startsWith('./dist/') || !runtime.startsWith('./dist/'))
      continue

    if (!specifier.includes('*')) {
      modules.push(describe(specifier, types, runtime, source))
      continue
    }
    if (!source) throw new Error(`Wildcard export ${specifier} has no solid source condition`)
    // Match the source pattern, then substitute the captured segment into the others.
    const sourcePattern = stripDot(source).replace(/^src\//, '')
    const [prefix, suffix] = sourcePattern.split('*') as [string, string]
    for (const file of sources) {
      if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue
      const captured = file.slice(prefix.length, file.length - suffix.length)
      if (captured === '' || (!suffix.includes('/') && captured.includes('/'))) continue
      const concrete = specifier.replace('*', captured)
      if (blocked.has(concrete)) continue
      modules.push(
        describe(
          concrete,
          types.replaceAll('*', captured),
          runtime.replaceAll('*', captured),
          source.replaceAll('*', captured)
        )
      )
    }
  }
  return modules.toSorted((a, b) => a.specifier.localeCompare(b.specifier))
}

function describe(
  specifier: string,
  types: string,
  runtime: string,
  source: string | undefined
): PublishedModule {
  return {
    specifier,
    types: stripDot(types),
    runtime: stripDot(runtime),
    ...(source ? { source: stripDot(source) } : {}),
    entry: stripDot(runtime)
      .replace(/^dist\//, '')
      .replace(/\.js$/, ''),
  }
}

/**
 * Rollup `input` entries for every published module that has a source file.
 *
 * Keyed by output name (`lib/themes`), valued by the absolute source path, so the
 * result can be spread straight into `build.lib.entry`.
 */
export function libraryEntries(
  modules: readonly PublishedModule[],
  packageRoot: string
): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const module of modules) {
    if (!module.source) continue
    entries[module.entry] = `${packageRoot.replace(/\/$/, '')}/${module.source}`
  }
  return entries
}

/** The result of comparing the exports a module declares with those it exports at runtime. */
export type ExportDiff = {
  /** Declared (value) exports the compiled module does not export: a consumer import fails. */
  missingAtRuntime: string[]
  /** Runtime exports the declaration file does not list: unreachable from typed code. */
  undeclared: string[]
}

export function diffExports(declared: Iterable<string>, runtime: Iterable<string>): ExportDiff {
  const declaredSet = new Set(declared)
  const runtimeSet = new Set(runtime)
  return {
    missingAtRuntime: [...declaredSet].filter((name) => !runtimeSet.has(name)).toSorted(),
    undeclared: [...runtimeSet].filter((name) => !declaredSet.has(name)).toSorted(),
  }
}
