import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtemp, writeFile, rm, unlink } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
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
const fontControlsBrowserEntry = packedRoot
  ? resolve(root, 'controls.tsx')
  : resolve(root, 'tests/fixtures/appearance-font-controls.tsx')
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
  // The fixture carries a catalogue long enough to overflow the theme menus'
  // fixed cap, so the internal scroll is under test; the pin proves the
  // renderer still bundles exactly the records the host imports.
  if (themeRecords.length !== 14)
    throw new Error('Expected exactly fourteen explicitly imported host theme records')
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
  // Previous composition baseline: 63,599 compiled / 64,126 Solid gzip JS bytes
  // and 50,059 raw CSS. The three-axis font editor adds its family/size controls
  // and the consumer's content/code role utilities; keep this fixture scoped to
  // those roles rather than scanning every heading variant in Typography.
  // Current measurements: compiled 77,064 gzip JS / Solid 77,642 gzip JS,
  // with 53,218 raw CSS bytes for both. The 52 KiB CSS cap leaves 30 bytes of
  // headroom; the 76 KiB gzip JS cap leaves 182 bytes in the Solid condition.
  // Re-baselined 64 → 76 KiB (2026-09) for the `cn` swap: measured 72,832 gzip —
  // the config-extended merge runtime ships cn's compiler and default tables.
  // Re-baselined 76 → 80 KiB (2026-10) when the popup became a docked inset
  // Sheet: Kobalte Dialog and the shared dialog focus restoration replace the
  // Popover, measured at 79,124 compiled gzip JS (+2,060). The fixture now
  // scans Sheet instead of Popover for utilities, measured at 55,204 raw CSS
  // (+2,546 for Sheet's sides, variants and slide motion): CSS cap 52 → 56 KiB.
  if (measurement.gzipJsBytes > 80 * 1024)
    throw new Error('Packed appearance host/editor exceeds 80 KiB gzip JS budget')
  if (measurement.cssBytes > 56 * 1024)
    throw new Error('Packed appearance host/editor exceeds measured 56 KiB raw CSS budget')
}

function inspectPackedFontControlsBundle(
  chunks: Awaited<ReturnType<typeof outputsFor>>,
  script: string,
  css: string
) {
  const js = chunks.filter((chunk) => chunk.type === 'chunk')
  if (js.length !== 1) throw new Error('Packed font controls must emit exactly one JS chunk')
  const modules = js.flatMap((chunk) =>
    Object.entries(chunk.modules)
      .filter(([, data]) => data.renderedLength > 0)
      .map(([id]) => id)
  )
  const ui = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
  const expected = browserCondition === 'compiled' ? '/dist/' : '/src/'
  if (!ui.length || !ui.every((id) => id.includes(expected)))
    throw new Error('Packed font-controls export conditions mixed or missing')
  if (
    !ui.some((id) => id.includes('/components/ui/button/')) ||
    !ui.some((id) => id.includes('/components/ui/input/'))
  )
    throw new Error('Packed font-controls fixture did not consume both shared controls')
  const unrelated = ui.filter((id) =>
    /\/components\/(?:composites\/appearance-editor|theme|conversation)|\/lib\/themes|xterm|codemirror/.test(
      id
    )
  )
  if (unrelated.length) throw new Error(`Unrelated font-controls modules: ${unrelated.join(', ')}`)
  const roots = new Set(
    modules
      .filter((id) => id.includes('/node_modules/solid-js/'))
      .map((id) =>
        id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
      )
  )
  if (roots.size !== 1) throw new Error(`Expected one Solid runtime, got ${roots.size}`)
  if (chunks.some((chunk) => /\.woff2?$/.test(chunk.fileName)))
    throw new Error('Font-controls renderer retained font assets')
  console.log(
    JSON.stringify({
      packedAppearanceFontControlsMeasurement: {
        condition: browserCondition,
        jsBytes: Buffer.byteLength(script),
        cssBytes: Buffer.byteLength(css),
        solidRuntimes: roots.size,
      },
    })
  )
}
async function outputsFor(result: Awaited<ReturnType<typeof build>>) {
  return (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
}

export async function startAppearanceFontAssetServer() {
  const entry = resolve(root, `.appearance-font-assets-${process.pid}.ts`)
  const stylesheet = packedRoot
    ? '@adea-ai/ui/fonts.css'
    : resolve(sourceRoot, 'src/styles/fonts.css')
  await writeFile(entry, `import ${JSON.stringify(stylesheet)}\n`)

  let css = ''
  const assets = new Map<string, Buffer>()
  try {
    const result = await build({
      root,
      configFile: false,
      logLevel: 'error',
      build: {
        write: false,
        assetsInlineLimit: 0,
        rollupOptions: { input: entry },
      },
    })
    for (const output of await outputsFor(result)) {
      if (output.type !== 'asset') continue
      if (output.fileName.endsWith('.css')) css += String(output.source)
      else if (/\.woff2?$/.test(output.fileName)) {
        assets.set(`/${output.fileName}`, Buffer.from(output.source))
      }
    }
  } finally {
    await unlink(entry)
  }
  if (!css || assets.size === 0) throw new Error('Font stylesheet did not emit local font assets')

  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    if (path === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(
        '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/font-assets.css"></head><body></body></html>'
      )
      return
    }
    if (path === '/font-assets.css') {
      response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' })
      response.end(css)
      return
    }
    const asset = assets.get(path)
    if (asset) {
      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'font/woff2',
        'Cache-Control': 'no-store',
      })
      response.end(asset)
      return
    }
    response.writeHead(404)
    response.end('Not found')
  })
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address() as AddressInfo | null
  if (!address || typeof address === 'string') throw new Error('Font asset server did not bind')
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      }),
  }
}

async function buildBrowserEntry(entry: string, name: string) {
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
        entry,
        formats: ['iife'],
        name,
        cssFileName: name.toLowerCase(),
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
  return { chunks, script, css }
}

export async function buildAppearanceBrowser() {
  const { chunks, ...result } = await buildBrowserEntry(browserEntry, 'AppearanceFixture')
  if (packedRoot) inspectPackedBundle(chunks, result.script, result.css)
  return result
}

export async function buildAppearanceFontControlsBrowser() {
  const { chunks, ...result } = await buildBrowserEntry(
    fontControlsBrowserEntry,
    'AppearanceFontControls'
  )
  if (packedRoot) inspectPackedFontControlsBundle(chunks, result.script, result.css)
  return result
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
