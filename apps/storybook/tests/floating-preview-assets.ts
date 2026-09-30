import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export async function buildFloatingPreviewBrowser() {
  const packedRoot = process.env['ADEA_FLOATING_PACKED_ROOT']
  const condition = process.env['ADEA_FLOATING_PACKED_CONDITION']
  const root = packedRoot
    ? resolve(packedRoot)
    : resolve(import.meta.dirname, '../../../packages/ui')
  const entry = packedRoot
    ? resolve(root, 'main.tsx')
    : resolve(root, 'tests/fixtures/floating-preview.tsx')
  const result = await build({
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    resolve: packedRoot
      ? { conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: false,
      lib: {
        entry,
        formats: ['iife'],
        name: 'FloatingPreviewFixture',
        cssFileName: 'floating-preview-fixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  return {
    script: assets
      .filter((asset) => asset.type === 'chunk')
      .map((asset) => asset.code)
      .join('\n'),
    css: assets
      .flatMap((asset) =>
        asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
      )
      .join('\n'),
  }
}
