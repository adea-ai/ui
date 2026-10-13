/**
 * Prove the lazy theme provider keeps the catalogue out of the start-up chunk.
 *
 * `ThemeProvider` imports the whole theme catalogue (34 themes, about 129 KB raw,
 * 34 KB gzipped) so `useTheme().themes` is complete on the first render. A host that
 * paints its theme from a stylesheet and keeps the default pair does not need it to
 * start, and `@adea-ai/ui/components/theme/lazy` is the provider that does not carry
 * it. The claim is only worth making if it is measured, so this bundles a minimal
 * consumer of each against the built package and reports where the catalogue lands:
 *
 *   1. **Eager**, from `@adea-ai/ui/components/theme`: the catalogue is in the start-up
 *      chunk. This is the control; if it were not there the lazy result would prove
 *      nothing.
 *   2. **Lazy**, from `@adea-ai/ui/components/theme/lazy`: no catalogue-only string is in
 *      any start-up chunk, the catalogue is in a chunk reached only by `import()`, and
 *      start-up stays inside the budget.
 *   3. **Lazy plus the host helpers an application imports beside it** from
 *      `@adea-ai/ui/lib/themes` (`tokensAsHex`, `isThemeAccentId`, `resolveVariant`):
 *      importing the module for those must not drag the catalogue back in.
 *
 * Run `bun run --cwd packages/ui build` first; like `check:tree-shaking`, this does not
 * build.
 * Run: bun run --cwd packages/ui check:theme-startup
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import { themes } from '@adea-ai/themes'
import { analyzeStartup, type BundleChunk } from './theme-startup-analysis'

const DIST = join(import.meta.dirname, '..', 'dist')
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

/** Gzipped bytes the lazy start-up may cost, and the least it must save over the eager control. */
const BUDGET = { lazyStartupGzip: 20 * 1024, minimumSavingGzip: 9 * 1024 }

/**
 * Strings that exist only in the catalogue's data: the descriptions of themes other than
 * the two defaults. Ids are not markers, because the id index ships with the provider.
 */
const MARKERS = themes
  .filter((theme) => theme.id !== 'adea-light' && theme.id !== 'adea-dark')
  .map((theme) => theme.description)
  .filter(
    (description, index, all) => description.length > 20 && all.indexOf(description) === index
  )
  .slice(0, 6)

async function bundle(source: string, dir: string, name: string): Promise<BundleChunk[]> {
  const entry = join(dir, `${name}.ts`)
  writeFileSync(entry, source)
  const result = await build({
    logLevel: 'silent',
    configFile: false,
    root: dir,
    build: {
      write: false,
      minify: 'esbuild',
      target: 'esnext',
      rollupOptions: { input: entry },
    },
    resolve: {
      // The built package, through the same subpaths a consumer writes.
      alias: [
        {
          find: /^@adea-ai\/ui\/components\/theme\/lazy$/,
          replacement: join(DIST, 'components/theme/lazy.js'),
        },
        {
          find: /^@adea-ai\/ui\/components\/(.*)$/,
          replacement: join(DIST, 'components/$1/index.js'),
        },
        { find: /^@adea-ai\/ui\/lib\/(.*)$/, replacement: join(DIST, 'lib/$1.js') },
      ],
      conditions: ['import', 'module', 'browser', 'default'],
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  return outputs
    .flatMap((item) => ('output' in item ? item.output : []))
    .flatMap((file) =>
      file.type === 'chunk'
        ? [
            {
              fileName: file.fileName,
              code: file.code,
              isEntry: file.isEntry,
              imports: file.imports,
              dynamicImports: file.dynamicImports,
            },
          ]
        : []
    )
}

const dir = mkdtempSync(join(tmpdir(), 'adea-theme-startup-'))
const findings: string[] = []
try {
  if (MARKERS.length < 3) throw new Error('could not derive catalogue markers from @adea-ai/themes')

  const measure = async (name: string, source: string) =>
    analyzeStartup(await bundle(source, dir, name), MARKERS, (code) => gzipSync(code).length)

  const eager = await measure(
    'eager',
    `import { ThemeProvider, themeScript, useTheme } from '@adea-ai/ui/components/theme'\nconsole.log(ThemeProvider, themeScript, useTheme)\n`
  )
  const lazy = await measure(
    'lazy',
    `import { ThemeProvider, themeScript, useTheme } from '@adea-ai/ui/components/theme/lazy'\nconsole.log(ThemeProvider, themeScript, useTheme)\n`
  )
  const lazyHost = await measure(
    'lazy-host',
    `import { ThemeProvider, themeScript } from '@adea-ai/ui/components/theme/lazy'\n` +
      `import { tokensAsHex, isThemeAccentId, resolveVariant } from '@adea-ai/ui/lib/themes'\n` +
      `console.log(ThemeProvider, themeScript, tokensAsHex, isThemeAccentId, resolveVariant)\n`
  )

  const row = (label: string, report: typeof eager) =>
    console.log(
      `  ${label.padEnd(22)} start-up ${kb(report.startupGzip).padStart(9)} gzipped ` +
        `(${kb(report.startupRaw)} raw, ${report.startup.length} chunk(s)); ` +
        `catalogue ${report.leaked.length > 0 ? 'in start-up' : report.deferred.length > 0 ? 'deferred' : 'absent'}`
    )
  console.log('theme start-up:')
  row('eager (control)', eager)
  row('lazy', lazy)
  row('lazy + lib/themes helpers', lazyHost)

  if (eager.leaked.length === 0)
    findings.push(
      'the eager control carries no catalogue marker, so the lazy result proves nothing.'
    )
  for (const [label, report] of [
    ['lazy', lazy],
    ['lazy + lib/themes helpers', lazyHost],
  ] as const) {
    if (report.leaked.length > 0)
      findings.push(
        `${label}: the catalogue is in the start-up chunk (found: ${report.leaked
          .slice(0, 2)
          .map((m) => JSON.stringify(m.slice(0, 40)))
          .join(', ')}). ` +
          'A static import now reaches lib/themes or @adea-ai/themes from the lazy entry; keep the catalogue behind import().'
      )
    if (report.missingFromDeferred.length > 0)
      findings.push(
        `${label}: the catalogue is in no deferred chunk, so the provider can no longer load it.`
      )
    if (report.startupGzip > BUDGET.lazyStartupGzip)
      findings.push(
        `${label}: start-up is ${kb(report.startupGzip)} gzipped, over the ${kb(BUDGET.lazyStartupGzip)} budget.`
      )
  }
  if (eager.startupGzip - lazy.startupGzip < BUDGET.minimumSavingGzip)
    findings.push(
      `lazy saves only ${kb(eager.startupGzip - lazy.startupGzip)} gzipped over eager; expected at least ${kb(BUDGET.minimumSavingGzip)}.`
    )
  console.log(
    `\n  saving         ${kb(eager.startupGzip - lazy.startupGzip)} gzipped, ${kb(eager.startupRaw - lazy.startupRaw)} raw at start-up`
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (findings.length > 0) {
  console.error('\ntheme start-up: over budget')
  for (const finding of findings) console.error(`  - ${finding}`)
  process.exit(1)
}
console.log('\ntheme start-up: the catalogue is out of the start-up chunk')
