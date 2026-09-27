import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

const packedRoot = process.env['ADEA_NATIVE_SELECT_PACKED_ROOT']
const packedCondition = process.env['ADEA_NATIVE_SELECT_PACKED_CONDITION']
const uiRoot = resolve(import.meta.dirname, '../../../packages/ui')

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid') {
  throw new Error('Packed NativeSelect fixture requires an explicit package condition')
}

export async function buildNativeSelectBrowser() {
  const entry = packedRoot
    ? resolve(packedRoot, 'main.tsx')
    : resolve(uiRoot, 'tests/fixtures/native-select.tsx')
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
              name: 'compiled-native-select-condition',
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
        entry,
        formats: ['iife'],
        name: 'NativeSelectFixture',
        cssFileName: 'native-select-fixture',
      },
    },
  })

  const outputs = Array.isArray(result) ? result : [result]
  const chunks = outputs.flatMap((output) => ('output' in output ? output.output : []))
  const scripts = chunks.filter((chunk) => chunk.type === 'chunk')
  if (scripts.length !== 1) throw new Error('NativeSelect fixture must emit one browser script')
  const script = scripts.map((chunk) => chunk.code).join('\n')
  const css = chunks
    .flatMap((chunk) =>
      chunk.type === 'asset' && chunk.fileName.endsWith('.css') ? [String(chunk.source)] : []
    )
    .join('\n')

  if (packedRoot) {
    const uiModules = scripts
      .flatMap((chunk) => Object.keys(chunk.modules))
      .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expectedPath = packedCondition === 'compiled' ? '/dist/' : '/src/'
    if (!uiModules.some((id) => id.includes(`/node_modules/@adea-ai/ui${expectedPath}`))) {
      throw new Error(`Packed fixture did not resolve NativeSelect from ${packedCondition}`)
    }
    if (uiModules.some((id) => id.includes(packedCondition === 'compiled' ? '/src/' : '/dist/'))) {
      throw new Error('Packed fixture mixed compiled and Solid-source package conditions')
    }
  }

  return { script, css }
}
