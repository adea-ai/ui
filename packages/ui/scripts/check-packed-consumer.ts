/** Packed artifacts, real package resolution, both compiled and Solid conditions. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'

const root = resolve(import.meta.dir, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-consumer-'))
const coreSamples = [
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
  for (const peer of ['chart.js', 'solid-chartjs', 'embla-carousel', 'embla-carousel-solid'])
    if (existsSync(join(consumer, 'node_modules', peer)))
      throw new Error(`Unused optional peer installed: ${peer}`)
  for (const name of ['LICENSE', 'NOTICE']) {
    const packed = readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist', name), 'utf8')
    if (packed !== readFileSync(join(root, '../..', name), 'utf8'))
      throw new Error(`Packed ${name} differs from repository attribution`)
  }
  const report: unknown[] = []
  const failures: string[] = []
  const optionalSamples = [
    {
      name: 'chart-subpath',
      imports:
        "import { LineChart } from '@adea-ai/ui/components/ui/chart'; console.log(LineChart)",
      jsx: '<button>Chart entry</button>',
      source: 'ui/chart',
    },
    {
      name: 'carousel-subpath',
      imports:
        "import { Carousel } from '@adea-ai/ui/components/ui/carousel'; console.log(Carousel)",
      jsx: '<button>Carousel entry</button>',
      source: 'ui/carousel',
    },
  ]
  // First prove every core entry with optional peers absent, then install the
  // advertised peers and resolve the optional entries from the same tarball.
  for (const phase of ['core', 'optional'] as const) {
    if (phase === 'optional') {
      const path = join(consumer, 'package.json')
      const installed = JSON.parse(readFileSync(path, 'utf8'))
      for (const peer of ['chart.js', 'solid-chartjs', 'embla-carousel', 'embla-carousel-solid'])
        installed.dependencies[peer] = manifest.peerDependencies[peer]
      writeFileSync(path, JSON.stringify(installed))
      execFileSync('bun', ['install', '--ignore-scripts'], { cwd: consumer, stdio: 'pipe' })
    }
    for (const condition of ['compiled', 'solid'] as const) {
      for (const sample of phase === 'core' ? coreSamples : optionalSamples) {
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
                ? `@source '../node_modules/@adea-ai/ui/src/components/${sample.source}';\n` +
                  (sample.name.startsWith('button') ||
                  sample.name === 'overlay' ||
                  sample.name === 'carousel-subpath'
                    ? "@source '../node_modules/@adea-ai/ui/src/lib/variants.ts';\n"
                    : '') +
                  (sample.name === 'overlay'
                    ? "@source '../node_modules/@adea-ai/ui/src/lib/overlay.ts';\n"
                    : '') +
                  (sample.name === 'overlay'
                    ? "@source '../node_modules/@adea-ai/ui/src/components/ui/{dialog,button}';\n"
                    : '') +
                  (sample.name === 'carousel-subpath'
                    ? "@source '../node_modules/@adea-ai/ui/src/components/ui/button';\n"
                    : '')
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
          const forbidden = modules.filter((id) => {
            if (
              /xterm|codemirror|shiki|storybook|\/components\/(?:theme|conversation)|\/lib\/themes/.test(
                id
              )
            )
              return true
            if (/chart\.js|solid-chartjs/.test(id)) return sample.name !== 'chart-subpath'
            if (/embla/.test(id)) return sample.name !== 'carousel-subpath'
            return false
          })
          const optionalEngine = sample.name === 'chart-subpath' ? /chart\.js/ : /embla-carousel/
          if (phase === 'optional' && !modules.some((id) => optionalEngine.test(id)))
            throw new Error('Optional public entry did not retain its advertised engine')
          if (forbidden.length)
            throw new Error(
              `${condition}/${sample.name} retains unused modules: ${forbidden.join(', ')}`
            )
          const solidRoots = new Set(
            modules
              .filter((id) => id.includes('/node_modules/solid-js/'))
              .map((id) =>
                id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
              )
          )
          if (solidRoots.size !== 1 || js.length !== 1)
            throw new Error('Expected one Solid runtime and one JS chunk')
          const code = js.map((chunk) => chunk.code).join('\n')
          const css = chunks
            .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
            .map((chunk) => (chunk.type === 'asset' ? String(chunk.source) : ''))
            .join('\n')
          if (sample.name.startsWith('button') && !css.includes('.bg-primary'))
            throw new Error('Packed Button is missing its Tailwind utility')
          if (sample.name.startsWith('button') && !css.includes('.h-control-md'))
            throw new Error('Packed Button is missing shared control sizing')
          if (sample.name === 'overlay' && !css.includes('.bg-popover'))
            throw new Error('Packed dialog is missing shared overlay styling')
          if (chunks.some((chunk) => /\.woff2?$/.test(chunk.fileName)))
            throw new Error('Fonts were shipped without fonts.css')
          const bytes = gzipSync(code).length
          report.push({
            condition,
            sample: sample.name,
            js: Buffer.byteLength(code),
            gzip: bytes,
            css: Buffer.byteLength(css),
            chunks: js.length,
            solidRuntimes: solidRoots.size,
            modules: modules.length,
          })
          if (sample.name.startsWith('button') && bytes > 40 * 1024)
            throw new Error(`Button exceeds existing 40 KiB gzip budget: ${bytes}`)
          // Complete discovered CSS: Button 32,155; dialog 39,385; shell 25,389.
          // The dialog's earlier 25,088 measurement omitted nested primitives/helpers.
          const cssCapKiB =
            sample.name === 'overlay'
              ? 40
              : sample.name === 'chart-subpath'
                ? 28
                : sample.name === 'carousel-subpath'
                  ? 35
                  : 32
          if (Buffer.byteLength(css) > cssCapKiB * 1024)
            throw new Error(`CSS exceeds measured ${cssCapKiB} KiB cap: ${Buffer.byteLength(css)}`)
          if ((sample.name === 'overlay' || sample.name === 'shell') && bytes > 32 * 1024)
            throw new Error('Overlay/shell exceeds measured 32 KiB gzip cap')
          if (phase === 'optional' && bytes > 180 * 1024)
            throw new Error('Optional entry exceeds existing 180 KiB gzip budget')
        } catch (error) {
          failures.push(`${condition}/${sample.name}: ${String(error).slice(0, 240)}`)
        }
      }
    }
  }
  console.log(JSON.stringify({ report, failures }, null, 2))
  if (failures.length) throw new Error(`${failures.length} packed consumer checks failed`)
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
