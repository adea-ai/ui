import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

const packedRoot = process.env['ADEA_APPEARANCE_PACKED_ROOT']
const browserCondition = process.env['ADEA_APPEARANCE_PACKED_CONDITION']
const sourceRoot = resolve(import.meta.dirname, '../../../packages/ui')
const root = packedRoot ?? sourceRoot
const browserEntry = packedRoot
  ? resolve(root, 'main.tsx')
  : resolve(root, 'tests/fixtures/appearance-editor.tsx')
const serverEntry = packedRoot
  ? resolve(root, 'server.tsx')
  : resolve(root, 'tests/fixtures/appearance-editor-ssr.tsx')
if (packedRoot && browserCondition !== 'compiled' && browserCondition !== 'solid')
  throw new Error('Packed fixture requires an explicit browser condition')

function inspectPackedBundle(
  chunks: Awaited<ReturnType<typeof outputsFor>>,
  script: string,
  css: string
) {
  const js = chunks.filter((chunk) => chunk.type === 'chunk')
  if (js.length !== 1) throw new Error('Packed renderer must emit exactly one JS chunk')
  const modules = js.flatMap((chunk) =>
    Object.entries(chunk.modules)
      .filter(([, data]) => data.renderedLength > 0)
      .map(([id]) => id)
  )
  const ui = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
  const expected = browserCondition === 'compiled' ? '/dist/' : '/src/'
  if (!ui.length || !ui.every((id) => id.includes(expected)))
    throw new Error('Renderer export conditions mixed or missing')
  const forbidden = modules.filter((id) =>
    /chart\.js|solid-chartjs|embla|xterm|codemirror|shiki|storybook|\/components\/(?:theme|conversation)|\/lib\/themes|@adea-ai\/themes\/dist\/(?:catalogue|normalize|sources|generated\/metadata)\.js/.test(
      id
    )
  )
  if (forbidden.length) throw new Error(`Unrelated renderer modules: ${forbidden.join(', ')}`)
  const themeRecords = modules.filter((id) => id.includes('@adea-ai/themes/dist/generated/themes/'))
  if (themeRecords.length !== 4)
    throw new Error('Expected exactly four explicitly imported host theme records')
  const roots = new Set(
    modules
      .filter((id) => id.includes('/node_modules/solid-js/'))
      .map((id) =>
        id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
      )
  )
  if (roots.size !== 1) throw new Error(`Expected one Solid runtime, got ${roots.size}`)
  if (chunks.some((chunk) => /\.woff2?$/.test(chunk.fileName)))
    throw new Error('Renderer retained font assets')
  const measurement = {
    condition: browserCondition,
    jsBytes: Buffer.byteLength(script),
    gzipJsBytes: gzipSync(script).length,
    cssBytes: Buffer.byteLength(css),
    solidRuntimes: roots.size,
    jsChunks: js.length,
  }
  console.log(JSON.stringify({ packedAppearanceMeasurement: measurement }))
  // The host fixture explicitly imports canonical theme records and color adapters.
  // Record the combined host/editor cost; UI never imports a palette engine.
  // Baselines: compiled 62,203 and Solid 62,643 gzip JS bytes; 50,060 raw CSS with all nested primitives/shared helpers.
  // New composition budgets have modest independent headroom, without widening core gates.
  if (measurement.gzipJsBytes > 64 * 1024)
    throw new Error('Packed appearance host/editor exceeds 64 KiB gzip JS budget')
  if (measurement.cssBytes > 50 * 1024)
    throw new Error('Packed appearance host/editor exceeds measured 50 KiB raw CSS budget')
}
async function outputsFor(result: Awaited<ReturnType<typeof build>>) {
  return (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
}
export async function buildAppearanceBrowser() {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && browserCondition === 'compiled'
        ? [
            {
              name: 'compiled-appearance-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (condition) => condition !== 'solid' && condition !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: packedRoot
      ? { conditions: browserCondition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: packedRoot ? 'esbuild' : false,
      target: 'esnext',
      lib: {
        entry: browserEntry,
        formats: ['iife'],
        name: 'AppearanceFixture',
        cssFileName: 'appearance-fixture',
      },
    },
  })
  const chunks = await outputsFor(result)
  const script = chunks
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
  const css = chunks
    .flatMap((chunk) =>
      chunk.type === 'asset' && chunk.fileName.endsWith('.css') ? [String(chunk.source)] : []
    )
    .join('\n')
  if (packedRoot) inspectPackedBundle(chunks, script, css)
  return { script, css }
}
/** Required Solid source SSR pipeline; compiled browser output is not treated as server code. */
export async function renderAppearanceServer() {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [solid({ ssr: true })],
    resolve: { conditions: ['solid', 'node', 'import'] },
    ssr: { noExternal: true },
    build: { write: false, minify: false, ssr: serverEntry },
  })
  const chunks = (await outputsFor(result)).filter((chunk) => chunk.type === 'chunk')
  if (chunks.length !== 1) throw new Error('Expected one server fixture chunk')
  const chunk = chunks[0]
  if (!chunk) throw new Error('Missing server fixture')
  if (packedRoot) {
    const ui = Object.keys(chunk.modules).filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    if (!ui.length || ui.some((id) => !id.includes('/src/')))
      throw new Error('Packed SSR did not select Solid source')
  }
  const directory = await mkdtemp(resolve(tmpdir(), 'adea-packed-appearance-ssr-'))
  try {
    await writeFile(resolve(directory, 'fixture.mjs'), chunk.code)
    await writeFile(
      resolve(directory, 'render.mjs'),
      "import { renderAppearance } from './fixture.mjs'; process.stdout.write(renderAppearance());"
    )
    return execFileSync(process.execPath, [resolve(directory, 'render.mjs')], { encoding: 'utf8' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
