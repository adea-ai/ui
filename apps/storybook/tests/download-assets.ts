import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export async function buildDownloadBrowser() {
  const uiRoot = resolve(import.meta.dirname, '../../../packages/ui')
  const result = await build({
    root: uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      target: 'esnext',
      lib: {
        entry: resolve(uiRoot, 'tests/fixtures/download.tsx'),
        formats: ['iife'],
        name: 'DownloadFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  const scripts = assets.filter((asset) => asset.type === 'chunk')
  if (scripts.length !== 1) throw new Error('Download fixture must emit one browser script')
  const script = scripts.map((asset) => asset.code).join('\n')
  const css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')

  return { script, css }
}
