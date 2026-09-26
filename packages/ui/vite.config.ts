import tailwindcss from '@tailwindcss/vite'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const componentEntries = readdirSync(resolve(import.meta.dirname, 'src/components'), {
  recursive: true,
})
  .map(String)
  .filter((file) => file.endsWith('/index.ts'))
const entries = Object.fromEntries([
  ['index', resolve(import.meta.dirname, 'src/index.ts')],
  ...componentEntries.map((file) => [
    `components/${file.slice(0, -'.ts'.length)}`,
    resolve(import.meta.dirname, 'src/components', file),
  ]),
])

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
 * CSS is emitted through Tailwind so the utilities components use are real.
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
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('#'),
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
    // The package ships CSS through the `./globals.css` export rather than as
    // a build artifact that components import, so no CSS modules are needed.
    modules: false,
  },
})
