import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

/**
 * Bundle one `packages/ui/tests/fixtures/<name>.tsx` entry into a single script
 * and its stylesheet, for a blank-page component spec.
 */
export async function bundleFixture(name: string): Promise<{ script: string; css: string }> {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, `../../../packages/ui/tests/fixtures/${name}.tsx`),
        formats: ['iife'],
        name: 'ComponentFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  return {
    script: assets.flatMap((asset) => (asset.type === 'chunk' ? [asset.code] : [])).join('\n'),
    css: assets
      .flatMap((asset) =>
        asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
      )
      .join('\n'),
  }
}
