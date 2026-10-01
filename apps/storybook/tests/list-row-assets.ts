import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

const packedRoot = process.env['ADEA_LIST_ROW_PACKED_ROOT']
const packedCondition = process.env['ADEA_LIST_ROW_PACKED_CONDITION']
const uiRoot = resolve(import.meta.dirname, '../../../packages/ui')

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid') {
  throw new Error('Packed ListRow fixture requires an explicit package condition')
}

export async function buildListRowBrowser() {
  const result = await build({
    root: packedRoot ?? uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && packedCondition === 'compiled'
        ? [
            {
              name: 'compiled-list-row-condition',
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
      ? { conditions: packedCondition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: packedRoot ? 'esbuild' : false,
      target: 'esnext',
      lib: {
        entry: packedRoot
          ? resolve(packedRoot, 'main.tsx')
          : resolve(uiRoot, 'tests/fixtures/list-row.tsx'),
        formats: ['iife'],
        name: 'ListRowFixture',
        cssFileName: 'list-row-fixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  const scripts = assets.filter((asset) => asset.type === 'chunk')
  if (scripts.length !== 1)
    throw new Error('ListRow fixture must emit exactly one JavaScript chunk')

  if (packedRoot) {
    const uiModules = scripts
      .flatMap((asset) => Object.keys(asset.modules))
      .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = packedCondition === 'compiled' ? '/dist/' : '/src/'
    if (!uiModules.some((id) => id.includes(expected)))
      throw new Error(`Packed ListRow did not resolve from ${packedCondition}`)
    if (uiModules.some((id) => id.includes(packedCondition === 'compiled' ? '/src/' : '/dist/')))
      throw new Error('Packed ListRow mixed compiled and Solid-source package conditions')
  }

  return {
    script: scripts.map((asset) => asset.code).join('\n'),
    css: assets
      .flatMap((asset) =>
        asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
      )
      .join('\n'),
  }
}
