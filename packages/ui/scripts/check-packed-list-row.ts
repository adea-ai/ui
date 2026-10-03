/** Browser-test rich and plain ListRow APIs from the exact packed archive. */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { EnvironmentOptions } from 'vite'
import { sharedPackedUiArchive } from './packed-artifact.mjs'
import { findUnrelatedPackedRowModules } from './packed-row-modules'

const root = resolve(import.meta.dir, '../../..')
const uiRoot = join(root, 'packages/ui')
const browserTestGrep = process.env['ADEA_LIST_ROW_TEST_GREP']
const browserRepeatEach = process.env['ADEA_LIST_ROW_REPEAT_EACH'] ?? '1'
const baselineArchivePath = process.env['ADEA_LIST_ROW_BASELINE_TARBALL']
const baselineArchiveSha256 = process.env['ADEA_LIST_ROW_BASELINE_SHA256']
const MAX_PLAIN_ROW_GZIP_BYTES = 40 * 1024

if (process.env['CI'] === 'true' && (browserTestGrep !== undefined || browserRepeatEach !== '1')) {
  throw new Error('CI must run the complete packed ListRow browser suite exactly once')
}

if (!/^[1-9]\d*$/.test(browserRepeatEach)) {
  throw new Error('ADEA_LIST_ROW_REPEAT_EACH must be a positive integer')
}

if ((baselineArchivePath === undefined) !== (baselineArchiveSha256 === undefined)) {
  throw new Error('A ListRow baseline archive requires both its path and SHA-256 digest')
}

if (baselineArchivePath && baselineArchiveSha256) {
  if (!/^[a-f0-9]{64}$/.test(baselineArchiveSha256))
    throw new Error('ListRow baseline archive SHA-256 digest is malformed')
  if (!existsSync(baselineArchivePath))
    throw new Error(`ListRow baseline archive does not exist: ${baselineArchivePath}`)
  const actualSha256 = createHash('sha256').update(readFileSync(baselineArchivePath)).digest('hex')
  if (actualSha256 !== baselineArchiveSha256)
    throw new Error(
      `ListRow baseline archive digest mismatch: expected ${baselineArchiveSha256}, received ${actualSha256}`
    )
}

// Invalid CI overrides must fail before loading the build toolchain. These
// modules have a cold-start cost that can exceed the unit test's process guard.
const [{ build }, { default: tailwindcss }, { default: solid }] = await Promise.all([
  import('vite'),
  import('@tailwindcss/vite'),
  import('vite-plugin-solid'),
])

const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-list-row-'))
let baselineConsumer: string | undefined

type RowSizeProbe = {
  component: 'ListRowControl' | 'ListRow'
  rawJsBytes: number
  gzipJsBytes: number
  cssBytes: number
  modules: string[]
}

function writeSizeProbeFiles(directory: string) {
  writeFileSync(
    join(directory, 'size-probe.css'),
    [
      "@import 'tailwindcss';",
      "@import '@adea-ai/ui/theme.css';",
      "@import '@adea-ai/ui/base.css';",
      "@source './size-plain.tsx';",
      "@source './size-rich.tsx';",
      "@source './node_modules/@adea-ai/ui/src/components/composites/list-row';",
      "@source './node_modules/@adea-ai/ui/src/components/ui/tooltip';",
      "@source './node_modules/@adea-ai/ui/src/lib/variants.ts';",
    ].join('\n')
  )
  writeFileSync(
    join(directory, 'size-plain.tsx'),
    `import { render } from 'solid-js/web'
import { ListRowControl } from '@adea-ai/ui/components/composites/list-row'
import './size-probe.css'

render(
  () => (
    <main>
      <ListRowControl
        as="a"
        href="#workspace"
        description="A short description that wraps naturally."
        leading={<span aria-hidden="true">W</span>}
        trailing={<span>Ready</span>}
      >
        Workspace
      </ListRowControl>
    </main>
  ),
  document.body
)
`
  )
  writeFileSync(
    join(directory, 'size-rich.tsx'),
    `import { render } from 'solid-js/web'
import { ListRow } from '@adea-ai/ui/components/composites/list-row'
import './size-probe.css'

render(
  () => (
    <main>
      <ListRow
        as="button"
        description="A short description that wraps naturally."
        tooltip="Open the workspace"
        leading={<span aria-hidden="true">W</span>}
        trailing={<span>Ready</span>}
      >
        Workspace
      </ListRow>
    </main>
  ),
  document.body
)
`
  )
}

async function measurePackedRow(
  directory: string,
  condition: 'compiled' | 'solid',
  component: RowSizeProbe['component']
): Promise<RowSizeProbe> {
  const entry = join(directory, component === 'ListRowControl' ? 'size-plain.tsx' : 'size-rich.tsx')
  const result = await build({
    root: directory,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      solid(),
      tailwindcss(),
      ...(condition === 'compiled'
        ? [
            {
              name: 'compiled-list-row-size-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (value) => value !== 'solid' && value !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: { conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] },
    build: {
      write: false,
      minify: 'esbuild',
      target: 'esnext',
      lib: {
        entry,
        formats: ['iife'],
        name: `Packed${component}`,
        cssFileName: 'list-row-size-probe',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  const chunks = assets.filter((asset) => asset.type === 'chunk')
  if (chunks.length !== 1)
    throw new Error(`${condition}/${component} size probe must emit exactly one JS chunk`)
  const chunk = chunks[0]
  if (!chunk || chunk.type !== 'chunk') throw new Error('Packed ListRow size probe is missing JS')
  const modules = Object.keys(chunk.modules).filter(
    (id) => (chunk.modules[id]?.renderedLength ?? 0) > 0
  )
  const packageModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
  const expected = condition === 'compiled' ? '/dist/' : '/src/'
  const alternate = condition === 'compiled' ? '/src/' : '/dist/'
  if (!packageModules.some((id) => id.includes(expected)))
    throw new Error(`${condition}/${component} size probe missed its packed package condition`)
  if (packageModules.some((id) => id.includes(alternate)))
    throw new Error(`${condition}/${component} size probe mixed packed package conditions`)
  const unrelated = findUnrelatedPackedRowModules(modules)
  if (unrelated.length)
    throw new Error(
      `${condition}/${component} size probe retained unrelated modules: ${unrelated.join(', ')}`
    )
  const hasTooltip = packageModules.some((id) => /\/components\/ui\/tooltip\//.test(id))
  if (
    component === 'ListRowControl' &&
    (hasTooltip || /aria-describedby|data-closed/.test(chunk.code))
  )
    throw new Error(`${condition}/ListRowControl retained rich Tooltip code`)
  if (component === 'ListRow' && (!hasTooltip || !/aria-describedby|data-closed/.test(chunk.code)))
    throw new Error(`${condition}/ListRow did not retain its rich Tooltip implementation`)

  const css = assets
    .filter((asset) => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    .map((asset) => (asset.type === 'asset' ? String(asset.source) : ''))
    .join('\n')
  return {
    component,
    rawJsBytes: Buffer.byteLength(chunk.code),
    gzipJsBytes: gzipSync(chunk.code).length,
    cssBytes: Buffer.byteLength(css),
    modules,
  }
}

async function measureRows(directory: string) {
  writeSizeProbeFiles(directory)
  const results: { condition: 'compiled' | 'solid'; plain: RowSizeProbe; rich: RowSizeProbe }[] = []
  for (const condition of ['compiled', 'solid'] as const) {
    const plain = await measurePackedRow(directory, condition, 'ListRowControl')
    const rich = await measurePackedRow(directory, condition, 'ListRow')
    if (plain.gzipJsBytes > MAX_PLAIN_ROW_GZIP_BYTES)
      throw new Error(
        `Packed ${condition} ListRowControl exceeds the 40 KiB gzip JS budget: ${plain.gzipJsBytes}`
      )
    results.push({ condition, plain, rich })
  }
  return results
}

async function measureRichRows(
  directory: string
): Promise<{ condition: 'compiled' | 'solid'; rich: RowSizeProbe }[]> {
  writeSizeProbeFiles(directory)
  const results: { condition: 'compiled' | 'solid'; rich: RowSizeProbe }[] = []
  for (const condition of ['compiled', 'solid'] as const) {
    results.push({ condition, rich: await measurePackedRow(directory, condition, 'ListRow') })
  }
  return results
}

try {
  let archivePath = sharedPackedUiArchive()
  if (!archivePath) {
    const [archive] = JSON.parse(
      execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
        cwd: uiRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      })
    ) as [{ filename: string }]
    archivePath = join(consumer, archive.filename)
  }

  const manifest = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
  }
  const tailwindVersion = JSON.parse(
    readFileSync(join(root, 'node_modules/tailwindcss/package.json'), 'utf8')
  ) as { version: string }
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'adea-packed-list-row-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
        'lucide-solid': manifest.dependencies['lucide-solid'],
        'solid-js': manifest.peerDependencies['solid-js'],
        tailwindcss: tailwindVersion.version,
      },
    })
  )
  execFileSync('bun', ['install', '--ignore-scripts', '--omit=optional'], {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 120_000,
  })
  // A consumer on a different filesystem than bun's cache gets copied
  // packages whose module IDs carry no inlined version, so the row-module
  // guard can only check chunk identity — pin the locked Corvu version here.
  const corvuManifest = join(consumer, 'node_modules/@corvu/utils/package.json')
  if (existsSync(corvuManifest)) {
    const corvuVersion = JSON.parse(readFileSync(corvuManifest, 'utf8')).version
    if (corvuVersion !== '0.4.2')
      throw new Error(
        `Packed ListRow consumer installed @corvu/utils@${corvuVersion}; the traced Tooltip path requires 0.4.2`
      )
  }

  const fixture = readFileSync(join(uiRoot, 'tests/fixtures/list-row.tsx'), 'utf8')
  const packageFixture = fixture
    .replace(
      '../../src/components/composites/action-button',
      '@adea-ai/ui/components/composites/action-button'
    )
    .replace(
      '../../src/components/composites/list-row',
      '@adea-ai/ui/components/composites/list-row'
    )
    .replace('../../src/components/ui/badge', '@adea-ai/ui/components/ui/badge')
    .replace('../../src/components/ui/button', '@adea-ai/ui/components/ui/button')
    .replace('../../src/styles/globals.css', './style.css')
  if (packageFixture.includes('../../src/'))
    throw new Error('Packed ListRow fixture retained a source-local component/style import')
  writeFileSync(join(consumer, 'main.tsx'), packageFixture)
  writeFileSync(
    join(consumer, 'style.css'),
    [
      "@import 'tailwindcss';",
      "@import '@adea-ai/ui/theme.css';",
      "@import '@adea-ai/ui/base.css';",
      "@source './main.tsx';",
      "@source './node_modules/@adea-ai/ui/src/components/composites/list-row';",
      "@source './node_modules/@adea-ai/ui/src/components/composites/action-button';",
      "@source './node_modules/@adea-ai/ui/src/components/ui/{badge,button}';",
      "@source './node_modules/@adea-ai/ui/dist/components/composites/list-row';",
      "@source './node_modules/@adea-ai/ui/dist/components/composites/action-button';",
      "@source './node_modules/@adea-ai/ui/dist/components/ui/{badge,button}';",
    ].join('\n')
  )
  writeFileSync(
    join(consumer, 'type-probe.tsx'),
    `import type { ListRowControlProps, ListRowProps } from '@adea-ai/ui/components/composites/list-row'

const richRow: ListRowProps<'button'> = {
  as: 'button',
  type: 'submit',
  tooltip: 'Explain this action',
  'aria-describedby': 'row-help',
  description: 'A wrapped description',
}
const plainRow: ListRowControlProps<'a'> = {
  as: 'a',
  href: '#details',
  description: 'A plain row description',
}
void [richRow, plainRow]
`
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
      },
      include: ['type-probe.tsx'],
    })
  )
  execFileSync(resolve(root, 'node_modules/.bin/tsc'), ['-p', join(consumer, 'tsconfig.json')], {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 120_000,
  })

  const installed = join(consumer, 'node_modules/@adea-ai/ui')
  for (const path of [
    'dist/components/composites/list-row/index.js',
    'dist/components/composites/list-row/index.d.ts',
    'dist/components/composites/list-row/list-row.js',
    'dist/components/composites/list-row/list-row-control.js',
    'dist/components/composites/list-row/list-row-control.d.ts',
    'src/components/composites/list-row/index.ts',
    'src/components/composites/list-row/list-row.tsx',
    'src/components/composites/list-row/list-row-control.tsx',
  ]) {
    if (!existsSync(join(installed, path))) throw new Error(`Packed entry missing: ${path}`)
  }

  const sizeReport = await measureRows(consumer)
  let richBaselineReport:
    | {
        archive: string
        archiveSha256: string
        comparison: {
          condition: 'compiled' | 'solid'
          baseline: RowSizeProbe
          current: RowSizeProbe
          deltaGzipJsBytes: number
        }[]
      }
    | undefined
  if (baselineArchivePath && baselineArchiveSha256) {
    baselineConsumer = mkdtempSync(join(tmpdir(), 'adea-packed-list-row-baseline-'))
    writeFileSync(
      join(baselineConsumer, 'package.json'),
      JSON.stringify({
        name: 'adea-packed-list-row-baseline-consumer',
        private: true,
        type: 'module',
        dependencies: {
          '@adea-ai/ui': `file:${resolve(baselineArchivePath)}`,
          'lucide-solid': manifest.dependencies['lucide-solid'],
          'solid-js': manifest.peerDependencies['solid-js'],
          tailwindcss: tailwindVersion.version,
        },
      })
    )
    execFileSync('bun', ['install', '--ignore-scripts', '--omit=optional'], {
      cwd: baselineConsumer,
      stdio: 'inherit',
      timeout: 120_000,
    })
    const baselineRows = await measureRichRows(baselineConsumer)
    richBaselineReport = {
      archive: resolve(baselineArchivePath),
      archiveSha256: baselineArchiveSha256,
      comparison: baselineRows.map(({ condition, rich: baseline }) => {
        const currentRow = sizeReport.find((row) => row.condition === condition)
        if (!currentRow) throw new Error(`Missing current ${condition} rich ListRow measurement`)
        const current = currentRow.rich
        return {
          condition,
          baseline,
          current,
          deltaGzipJsBytes: current.gzipJsBytes - baseline.gzipJsBytes,
        }
      }),
    }
  }

  const storybook = join(root, 'apps/storybook')
  const conditionResults: {
    condition: 'compiled' | 'solid'
    result: 'passed' | 'failed'
    status: number | null
  }[] = []
  for (const condition of ['compiled', 'solid'] as const) {
    try {
      execFileSync(
        'bun',
        [
          'run',
          '--cwd',
          storybook,
          'test:components',
          '--',
          'tests/component-list-row.spec.ts',
          ...(browserTestGrep ? ['--grep', browserTestGrep] : []),
          ...(browserRepeatEach === '1' ? [] : ['--repeat-each', browserRepeatEach]),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            ADEA_LIST_ROW_PACKED_ROOT: consumer,
            ADEA_LIST_ROW_PACKED_CONDITION: condition,
          },
          stdio: 'inherit',
          timeout: 240_000,
        }
      )
      conditionResults.push({ condition, result: 'passed', status: 0 })
    } catch (error) {
      const status =
        error instanceof Error && 'status' in error && typeof error.status === 'number'
          ? error.status
          : null
      conditionResults.push({ condition, result: 'failed', status })
    }
  }

  console.log(
    JSON.stringify({
      result: conditionResults.every(({ result }) => result === 'passed')
        ? 'packed ListRow browser contract passed'
        : 'packed ListRow browser contract failed',
      conditions: conditionResults,
      engines: ['chromium', 'webkit'],
      browserTestGrep: browserTestGrep ?? null,
      browserRepeatEach: Number(browserRepeatEach),
      browserCasesPerCondition: browserTestGrep ? null : 16,
      sizeReport,
      richBaselineReport,
      nativeTypes: 'passed',
      archive: archivePath,
      archiveSha256: createHash('sha256').update(readFileSync(archivePath)).digest('hex'),
    })
  )
  if (conditionResults.some(({ result }) => result === 'failed')) {
    throw new Error('A packed ListRow export condition failed its browser contract')
  }
} finally {
  rmSync(consumer, { recursive: true, force: true })
  if (baselineConsumer) rmSync(baselineConsumer, { recursive: true, force: true })
}
