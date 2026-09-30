import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

const packedRoot = process.env['ADEA_SETTINGS_NAV_PACKED_ROOT']
const packedCondition = process.env['ADEA_SETTINGS_NAV_PACKED_CONDITION']
const uiRoot = resolve(import.meta.dirname, '../../../packages/ui')

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid') {
  throw new Error('Packed SettingsNavigation fixture requires an explicit package condition')
}

export async function buildSettingsNavigationBrowser() {
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
              name: 'compiled-settings-navigation-condition',
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
          : resolve(uiRoot, 'tests/fixtures/settings-navigation.tsx'),
        formats: ['iife'],
        name: 'SettingsNavigationFixture',
      },
    },
  })

  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  const scripts = assets.filter((asset) => asset.type === 'chunk')
  if (scripts.length !== 1)
    throw new Error('SettingsNavigation fixture must emit exactly one JavaScript chunk')

  if (packedRoot) {
    const uiModules = scripts
      .flatMap((asset) => Object.keys(asset.modules))
      .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = packedCondition === 'compiled' ? '/dist/' : '/src/'
    if (!uiModules.some((id) => id.includes(expected)))
      throw new Error(`Packed SettingsNavigation did not resolve from ${packedCondition}`)
    if (uiModules.some((id) => id.includes(packedCondition === 'compiled' ? '/src/' : '/dist/')))
      throw new Error('Packed SettingsNavigation mixed compiled and Solid-source conditions')
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
