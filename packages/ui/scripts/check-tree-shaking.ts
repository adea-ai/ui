/**
 * Prove the library tree-shakes, with a number.
 *
 * The claim a consumer needs is not "the package is small" — it is "importing one
 * component does not pull in the other fifty-eight". That claim is only worth
 * making if it is measured, so this builds two real bundles against the built
 * package and reports what each one costs:
 *
 *   one component   `import { Button }` from the package root
 *   the whole kit   every export, for comparison
 *
 * The budgets below are deliberately tight. A regression here is silent — nothing
 * fails, the application just gets bigger — and the failure mode is usually a
 * module-level side effect or a barrel that re-exports something with one.
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
 * Budgets, in gzipped bytes, for a production build with React-style minification
 * disabled in favour of esbuild's default (which is what a real consumer gets).
 *
 * `ONE_COMPONENT` is the number that matters. It covers Button plus the Solid
 * runtime it needs and the class-name helpers — roughly 25 kB gzipped, which is
 * the floor for any Solid component with `clsx` and `tailwind-merge` in it.
 *
 * `RATIO` is the second guard: the one-component bundle must stay a small fraction
 * of the whole library. A barrel that stops shaking does not usually blow the
 * absolute budget on its own — it moves the ratio, which is the signal.
 */
const BUDGETS = {
  oneComponentBytes: 40 * 1024,
  ratioOfWholeLibrary: 0.25,
}

/** Bytes as a human-readable size, for the report and the findings. */
function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`
}

async function bundle(
  entrySource: string,
  dir: string,
  name: string
): Promise<{ raw: number; gzip: number; chunks: number }> {
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

  const findings = []
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

  if (findings.length > 0) {
    console.error('\ntree-shaking: FAILED')
    for (const finding of findings) console.error(`  - ${finding}`)
    process.exit(1)
  }

  console.log('tree-shaking: within budget')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
