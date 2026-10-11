import tailwindcss from '@tailwindcss/vite'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const componentEntries = readdirSync(resolve(import.meta.dirname, 'src/components'), {
  recursive: true,
})
  .map(String)
  .filter((file) => file.endsWith('/index.ts'))
const entries = Object.fromEntries([
  ['index', resolve(import.meta.dirname, 'src/index.ts')],
  ['lint', resolve(import.meta.dirname, 'src/lint/index.ts')],
  ['lib/download', resolve(import.meta.dirname, 'src/lib/download.ts')],
  ...componentEntries.map((file) => [
    `components/${file.slice(0, -'.ts'.length)}`,
    resolve(import.meta.dirname, 'src/components', file),
  ]),
])
const sourceRoot = resolve(import.meta.dirname, 'src')

function isComponentCssImport(id: string, importer?: string): boolean {
  if (!id.endsWith('.css') || !importer) return false
  const sourceFile = isAbsolute(id) ? id : resolve(dirname(importer), id)
  const sourceRelative = relative(sourceRoot, sourceFile).split(sep).join('/')
  return sourceRelative.startsWith('components/')
}

/**
 * Library build.
 *
 * Two output shapes on purpose, because the two consumer apps want different
 * things from a component package:
 *
 *   - `dist/*.js` is a compiled ESM copy, selected by the default `import`
 *     condition. It is what a non-Vite consumer, a test runner without the
 *     Solid plugin, or a bundler that ignores custom conditions will load.
 *   - `src/*` is selected by the `solid` and `development` conditions. Vite
 *     plus `vite-plugin-solid` resolve those, so an app gets the real source
 *     with working HMR and no double-compile.
 *
 * `solid-js`, Kobalte, corvu, and the rest stay external: bundling a copy of
 * `solid-js` into a library is how two reactive runtimes end up in one app.
 * Component CSS stays a relative side-effect import beside its compiled
 * module, so an unused component does not add its styles to every app.
 */
export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    {
      name: 'package-notices',
      generateBundle() {
        for (const fileName of ['LICENSE', 'NOTICE']) {
          this.emitFile({
            type: 'asset',
            fileName,
            source: readFileSync(resolve(import.meta.dirname, '../..', fileName), 'utf8'),
          })
        }
      },
    },
    {
      name: 'component-css-side-effects',
      generateBundle(_options, bundle) {
        const emitted = new Set<string>()
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') continue
          const sourceModule =
            chunk.facadeModuleId ?? Object.keys(chunk.modules).find((id) => id.endsWith('.tsx'))
          if (!sourceModule) continue
          for (const imported of chunk.imports.filter((file) => file.endsWith('.css'))) {
            const sourceFile = isAbsolute(imported)
              ? imported
              : imported.replaceAll(sep, '/').startsWith('components/')
                ? resolve(sourceRoot, imported)
                : resolve(dirname(sourceModule), imported)
            const sourceRelative = relative(sourceRoot, sourceFile)
            const sourceRelativePosix = sourceRelative.split(sep).join('/')
            if (!sourceRelativePosix.startsWith('components/')) continue

            const source = readFileSync(sourceFile)
            if (/@import\b|url\(/i.test(source.toString('utf8')))
              throw new Error(
                `Component CSS side-effect asset dependencies need an explicit copy rule: ${sourceRelativePosix}`
              )

            const outputFile = sourceRelativePosix
            if (emitted.has(outputFile)) continue
            emitted.add(outputFile)
            this.emitFile({
              type: 'asset',
              fileName: outputFile,
              source,
            })
          }
        }
      },
    },
  ],
  build: {
    lib: {
      entry: entries,
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      /**
       * Every bare specifier is external; only our own relative and `#lib/*`
       * imports are bundled.
       *
       * A hand-maintained allow-list of package names is how a dependency ends
       * up silently duplicated in a library build: adding an import to a
       * component is invisible to the list, and the failure mode is a second
       * copy of a stateful package in the consumer's bundle rather than an
       * error. Inverting the test means a new dependency is external by default.
       */
      // Leave relative component CSS imports intact. The plugin above copies
      // their source alongside the preserved component module in `dist`.
      external: (id, importer) =>
        isComponentCssImport(id, importer) ||
        (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('#')),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
  },
  css: {
    // Component CSS uses named class hooks and semantic tokens, not CSS modules.
    modules: false,
  },
})
