/** Packed artifacts, real package resolution, both compiled and Solid conditions. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'

const root = resolve(import.meta.dir, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-consumer-'))
const samples = [
  { name: 'baseline', imports: '', jsx: '<button>Baseline</button>', source: '' },
  {
    name: 'button-root',
    imports: "import { Button } from '@adea-ai/ui'",
    jsx: '<Button>Action</Button>',
    source: 'ui/button',
  },
  {
    name: 'button-subpath',
    imports: "import { Button } from '@adea-ai/ui/components/ui/button'",
    jsx: '<Button>Action</Button>',
    source: 'ui/button',
  },
  {
    name: 'overlay',
    imports: "import { ModalDialog } from '@adea-ai/ui'",
    jsx: '<ModalDialog open onClose={() => {}} title="Details">Content</ModalDialog>',
    source: 'ui/modal-dialog',
  },
  {
    name: 'shell',
    imports: "import { AppShell, AppShellBody, AppShellMain } from '@adea-ai/ui'",
    jsx: '<AppShell><AppShellBody><AppShellMain>Session</AppShellMain></AppShellBody></AppShell>',
    source: 'layout/app-shell',
  },
]

try {
  const [archive] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  )
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${join(consumer, archive.filename)}`,
        'solid-js': manifest.peerDependencies['solid-js'],
        tailwindcss: '^4.3.3',
      },
    })
  )
  // Ignore dependency install scripts. No optional chart/carousel engines belong in
  // the lightweight consumer; the source barrel must work without them installed.
  execFileSync('bun', ['install', '--ignore-scripts'], { cwd: consumer, stdio: 'pipe' })
  const report: unknown[] = []
  const failures: string[] = []
  for (const condition of ['compiled', 'solid'] as const) {
    for (const sample of samples) {
      try {
        const dir = join(consumer, `${condition}-${sample.name}`)
        mkdirSync(dir)
        writeFileSync(
          join(dir, 'index.html'),
          '<div id="app"></div><script type="module" src="/main.tsx"></script>'
        )
        writeFileSync(
          join(dir, 'main.tsx'),
          `import { render } from 'solid-js/web';\n${sample.imports}\nimport './style.css';\nrender(() => ${sample.jsx}, document.getElementById('app')!);`
        )
        writeFileSync(
          join(dir, 'style.css'),
          "@import 'tailwindcss';\n@import '@adea-ai/ui/theme.css';\n@import '@adea-ai/ui/base.css';\n" +
            (sample.source
              ? `@source '../node_modules/@adea-ai/ui/src/components/${sample.source}';\n`
              : '')
        )
        const result = await build({
          root: dir,
          configFile: false,
          logLevel: 'warn',
          plugins: [
            solid(),
            tailwindcss(),
            ...(condition === 'compiled'
              ? [
                  {
                    name: 'packed-compiled-condition',
                    enforce: 'post' as const,
                    configEnvironment(_name: string, config: EnvironmentOptions) {
                      config.resolve ??= {}
                      config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                        (value) => value !== 'solid' && value !== 'development'
                      )
                    },
                  },
                ]
              : []),
          ],
          resolve: {
            conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'],
          },
          build: { write: false, minify: 'esbuild', target: 'esnext', modulePreload: false },
        })
        const outputs = Array.isArray(result) ? result : [result]
        const chunks = outputs.flatMap((output) => ('output' in output ? output.output : []))
        const js = chunks.filter((chunk) => chunk.type === 'chunk')
        const modules = js.flatMap((chunk) => Object.keys(chunk.modules))
        const uiModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
        const expectedPath = condition === 'compiled' ? '/dist/' : '/src/'
        if (sample.name !== 'baseline' && !uiModules.some((id) => id.includes(expectedPath)))
          throw new Error(`Expected ${condition} UI exports`)
        if (uiModules.some((id) => id.includes(condition === 'compiled' ? '/src/' : '/dist/')))
          throw new Error('Mixed UI export conditions')
        const forbidden = modules.filter((id) =>
          /chart\.js|solid-chartjs|embla|xterm|codemirror|shiki|storybook|\/components\/(?:theme|conversation)|\/lib\/themes/.test(
            id
          )
        )
        if (forbidden.length)
          throw new Error(
            `${condition}/${sample.name} retains unused modules: ${forbidden.join(', ')}`
          )
        const code = js.map((chunk) => chunk.code).join('\n')
        const css = chunks
          .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
          .map((chunk) => (chunk.type === 'asset' ? String(chunk.source) : ''))
          .join('\n')
        if (sample.name.startsWith('button') && !css.includes('.bg-primary'))
          throw new Error('Packed Button is missing its Tailwind utility')
        if (chunks.some((chunk) => /\.woff2?$/.test(chunk.fileName)))
          throw new Error('Fonts were shipped without fonts.css')
        const bytes = gzipSync(code).length
        if (sample.name.startsWith('button') && bytes > 40 * 1024)
          throw new Error(`Button exceeds existing 40 KiB gzip budget: ${bytes}`)
        report.push({
          condition,
          sample: sample.name,
          js: Buffer.byteLength(code),
          gzip: bytes,
          css: Buffer.byteLength(css),
          chunks: js.length,
          modules: modules.length,
        })
      } catch (error) {
        failures.push(`${condition}/${sample.name}: ${String(error).slice(0, 240)}`)
      }
    }
  }
  console.log(JSON.stringify({ report, failures }, null, 2))
  if (failures.length) throw new Error(`${failures.length} packed consumer checks failed`)
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
