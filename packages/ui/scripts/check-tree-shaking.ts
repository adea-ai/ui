/**
 * Prove the library tree-shakes, with a number.
 *
 * The claim a consumer needs is not "the package is small" — it is "importing one
 * component does not pull in the other sixty". That claim is only worth making if
 * it is measured, so this builds real bundles against the built package and
 * reports what each one costs.
 *
 * Three questions, because a single ratio cannot answer all of them:
 *
 * 1. **Does one component cost one component?** `Button` from the package root,
 *    against every export. The absolute budget catches a heavy module reached
 *    through the barrel; the ratio catches a barrel that stopped shaking.
 * 2. **What does each heavy component actually cost?** A per-component report, so
 *    a consumer choosing between them has a number rather than a promise. These
 *    are the ones that pull a real dependency: `chart.js`, `embla`, corvu, and
 *    Kobalte's navigation menu.
 * 3. **Do the chart types split from each other?** The chart wrapper claims that
 *    importing `LineChart` does not carry the radar and polar-area controllers.
 *    That is a claim about chart.js's registration model, and it is only true if
 *    it is measured — one `register(...)` of everything would break it silently.
 *
 * Run: bun run --cwd packages/ui check:tree-shaking
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

const PACKAGE_ROOT = new URL('..', import.meta.url).pathname
const DIST = join(PACKAGE_ROOT, 'dist')

/**
 * Budgets, in gzipped bytes, for a production build with esbuild's minifier —
 * what a real consumer gets.
 *
 * `oneComponentBytes` is the number that matters most. It covers `Button` plus the
 * Solid runtime it needs and the class-name helpers — the floor for any Solid
 * component with `clsx` and `tailwind-merge` in it.
 *
 * `heaviestComponentBytes` bounds the worst case a consumer can hit by importing
 * one component. It sits above the chart, which is the honest ceiling: a chart
 * wrapper that pulls `chart.js` costs what `chart.js` costs. What the budget
 * guards is that nothing *else* starts pulling a dependency of that size.
 *
 * `ratioOfWholeLibrary` is the second guard: the one-component bundle must stay a
 * small fraction of the library. A barrel that stops shaking does not usually blow
 * the absolute budget on its own — it moves the ratio, which is the signal.
 */
const BUDGETS = {
  oneComponentBytes: 40 * 1024,
  heaviestComponentBytes: 180 * 1024,
  ratioOfWholeLibrary: 0.25,
}

/**
 * The components worth a published number, each imported on its own from the
 * package root — the way a consumer imports them, so a barrel that stops shaking
 * shows up here and not only in the one-component check.
 */
const SAMPLES: readonly { name: string; names: readonly string[]; note: string }[] = [
  { name: 'Button', names: ['Button'], note: 'the floor: no dependency of its own' },
  { name: 'Board', names: ['Board'], note: 'no dependency' },
  { name: 'CodeBlock', names: ['CodeBlock'], note: 'lucide icons' },
  { name: 'DiffBlock', names: ['DiffBlock'], note: 'lucide icons' },
  { name: 'MessageRow', names: ['MessageRow'], note: 'conversation layer, no dependency' },
  { name: 'ModalDialog', names: ['ModalDialog'], note: 'Kobalte dialog' },
  { name: 'NavigationMenu', names: ['NavigationMenu'], note: 'Kobalte navigation menu' },
  { name: 'CalendarSurface', names: ['CalendarSurface'], note: 'corvu calendar' },
  { name: 'Carousel', names: ['Carousel'], note: 'embla' },
  { name: 'LineChart', names: ['LineChart'], note: 'chart.js, line controller only' },
  {
    name: 'AllCharts',
    names: [
      'LineChart',
      'BarChart',
      'RadarChart',
      'PolarAreaChart',
      'DonutChart',
      'ScatterChart',
      'BubbleChart',
    ],
    note: 'every chart controller',
  },
]

/** Bytes as a human-readable size, for the report and the findings. */
function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`
}

type BundleSize = { raw: number; gzip: number; chunks: number }

async function bundle(entrySource: string, dir: string, name: string): Promise<BundleSize> {
  const entry = join(dir, `${name}.ts`)
  writeFileSync(entry, entrySource)

  const outDir = join(dir, `out-${name}`)
  const result = await build({
    logLevel: 'silent',
    configFile: false,
    build: {
      write: false,
      outDir,
      minify: 'esbuild',
      target: 'esnext',
      lib: { entry, formats: ['es'], fileName: () => `${name}.js` },
      rollupOptions: { external: [] },
    },
    resolve: {
      // The built package, so this measures what ships rather than the source.
      alias: { '@adea-ai/ui': join(DIST, 'index.js') },
      conditions: ['import', 'module', 'browser', 'default'],
    },
  })

  const outputs = Array.isArray(result) ? result : [result]
  const chunks = outputs.flatMap((item) =>
    'output' in item ? (item.output ?? []).filter((file) => file.type === 'chunk') : []
  )

  const code = chunks.map((chunk) => chunk.code).join('\n')
  return { raw: Buffer.byteLength(code), gzip: gzipSync(code).length, chunks: chunks.length }
}

const dir = mkdtempSync(join(tmpdir(), 'adea-tree-shaking-'))

try {
  const one = await bundle(
    `import { Button } from '@adea-ai/ui'\nconsole.log(Button)\n`,
    dir,
    'one'
  )
  const whole = await bundle(`export * from '@adea-ai/ui'\n`, dir, 'whole')
  const ratio = one.gzip / whole.gzip

  console.log('tree-shaking:')
  console.log(
    `  one component  ${kb(one.gzip)} gzipped  (${kb(one.raw)} raw, ${one.chunks} chunks)`
  )
  console.log(
    `  whole library  ${kb(whole.gzip)} gzipped  (${kb(whole.raw)} raw, ${whole.chunks} chunks)`
  )
  console.log(`  ratio          ${(ratio * 100).toFixed(1)}% of the whole library`)

  console.log('\n  per component, imported from the package root:')
  const sizes = new Map<string, BundleSize>()
  for (const sample of SAMPLES) {
    const size = await bundle(
      `import { ${sample.names.join(', ')} } from '@adea-ai/ui'\n` +
        `console.log(${sample.names.join(', ')})\n`,
      dir,
      `sample-${sample.name}`
    )
    sizes.set(sample.name, size)
    console.log(
      `    ${sample.name.padEnd(16)} ${kb(size.gzip).padStart(9)} gzipped   ${sample.note}`
    )
  }

  const heaviest = [...sizes.entries()].reduce((worst, entry) =>
    entry[1].gzip > worst[1].gzip ? entry : worst
  )

  const findings: string[] = []

  if (one.gzip > BUDGETS.oneComponentBytes) {
    findings.push(
      `importing one component costs ${kb(one.gzip)}, over the ${kb(BUDGETS.oneComponentBytes)} budget. ` +
        'Something is being pulled in that a single component should not need — check for a module-level ' +
        'side effect, or a re-export in src/index.ts that reaches a heavy module.'
    )
  }
  if (ratio > BUDGETS.ratioOfWholeLibrary) {
    findings.push(
      `one component is ${(ratio * 100).toFixed(1)}% of the whole library, over the ` +
        `${(BUDGETS.ratioOfWholeLibrary * 100).toFixed(0)}% budget. Tree-shaking has stopped working.`
    )
  }
  if (heaviest[1].gzip > BUDGETS.heaviestComponentBytes) {
    findings.push(
      `the heaviest component (${heaviest[0]}) costs ${kb(heaviest[1].gzip)}, over the ` +
        `${kb(BUDGETS.heaviestComponentBytes)} budget. A dependency is being pulled into more than the ` +
        'component that needs it.'
    )
  }

  /**
   * The chart split. `LineChart` must not carry the controllers it does not use —
   * the whole reason chart.js was chosen over a batteries-included library, and a
   * single `register(...)` of everything would break it with nothing failing.
   */
  const line = sizes.get('LineChart')!
  const allCharts = sizes.get('AllCharts')!
  const saved = allCharts.gzip - line.gzip
  console.log(
    `\n  chart split    LineChart is ${kb(saved)} smaller than every chart type together ` +
      `(${kb(line.gzip)} vs ${kb(allCharts.gzip)})`
  )
  if (line.gzip >= allCharts.gzip) {
    findings.push(
      'importing one chart type costs as much as importing all of them. The chart controllers are being ' +
        'registered from one module, so chart.js cannot drop the unused ones.'
    )
  }

  if (findings.length > 0) {
    console.error('\ntree-shaking: FAILED')
    for (const finding of findings) console.error(`  - ${finding}`)
    process.exit(1)
  }

  console.log('\ntree-shaking: within budget')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
