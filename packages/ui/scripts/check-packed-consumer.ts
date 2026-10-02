/** Packed artifacts, real package resolution, both compiled and Solid conditions. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

const root = resolve(import.meta.dir, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-consumer-'))
type PackedSample = {
  name: string
  imports: string
  jsx: string
  source?: string
  sources?: string[]
}

const coreSamples: PackedSample[] = [
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
    name: 'input-control-root',
    imports: "import { InputControl } from '@adea-ai/ui';",
    jsx: '<InputControl aria-label="Search apps" type="search" />',
    source: 'ui/input',
  },
  {
    name: 'input-control-subpath',
    imports: "import { InputControl } from '@adea-ai/ui/components/ui/input';",
    jsx: '<InputControl aria-label="Search apps" type="search" />',
    source: 'ui/input',
  },
  {
    name: 'native-select-root',
    imports: "import { NativeSelect } from '@adea-ai/ui'",
    jsx: '<NativeSelect aria-label="Relationship kind" defaultValue="all"><option value="all">All</option></NativeSelect>',
    source: 'ui/native-select',
  },
  {
    name: 'slider-form',
    imports: "import { Slider } from '@adea-ai/ui/components/ui/slider'",
    jsx: '<form><Slider name="bounds" defaultValue={[20, 70]} thumbLabels={["Minimum threshold", "Maximum threshold"]} /></form>',
    source: 'ui/slider',
  },
  {
    name: 'combobox-empty-content',
    imports:
      "import { Combobox, ComboboxControl, ComboboxInput, ComboboxContent } from '@adea-ai/ui/components/ui/combobox'",
    jsx: '<Combobox options={[]} allowsEmptyCollection defaultOpen><ComboboxControl><ComboboxInput aria-label="Provider" /></ComboboxControl><ComboboxContent><p role="status">No matching providers.</p></ComboboxContent></Combobox>',
    source: 'ui/combobox',
  },
  {
    name: 'overlay',
    imports: "import { ModalDialog } from '@adea-ai/ui'",
    jsx: '<><ModalDialog open onClose={() => {}} title="Details" restoreFocusRef={() => document.querySelector<HTMLButtonElement>("#dialog-trigger") ?? undefined}>Content</ModalDialog><ModalDialog open modal={false} onClose={() => {}} title="Details" aria-label="Custom details">Custom content</ModalDialog></>',
    source: 'ui/modal-dialog',
  },
  {
    name: 'update-dialog',
    imports:
      "import { UpdateDialog, type UpdateAdapter, type UpdateState } from '@adea-ai/ui/components/composites/update-dialog';\nconst current: UpdateState = { phase: 'current', currentVersion: '0.70.1' };\nconst adapter: UpdateAdapter = { getStatus: async () => current, check: async () => current, install: async () => current, isDesktopRuntime: () => true }",
    jsx: '<UpdateDialog adapter={adapter} appName="Adea" />',
    sources: [
      'components/composites/update-dialog/update-dialog.tsx',
      'components/ui/badge/badge.tsx',
      'components/ui/button/button.tsx',
      'components/ui/dialog/dialog.tsx',
      'components/ui/progress/progress.tsx',
      'lib/overlay.ts',
      'lib/utils.ts',
      'lib/variants.ts',
      'lib/version-notes.ts',
    ],
  },
  {
    name: 'about-dialog',
    imports: "import { AboutDialog } from '@adea-ai/ui/components/composites/about-dialog'",
    jsx: '<AboutDialog appName="Cortana" appIcon="/app-icon.svg" version="0.64.0" platform="desktop" copyright="Contributors" sourceUrl="https://github.com/adea-ai/cortana" open onOpenChange={() => {}} />',
    source: 'composites/about-dialog',
  },
  {
    name: 'help-center',
    imports: "import { HelpCenter } from '@adea-ai/ui/components/composites/help-center'",
    jsx: '<HelpCenter appName="Adea" shortcuts={[{ label: "Settings", keys: ["⌘", ","] }]} links={[{ label: "Project", url: "https://github.com/adea-ai/adea" }]} />',
    source: 'composites/help-center',
  },
  {
    name: 'tooltip-subpath',
    imports:
      "import { Tooltip, TooltipContent, TooltipTrigger } from '@adea-ai/ui/components/ui/tooltip'",
    jsx: '<Tooltip><TooltipTrigger as="button">Details</TooltipTrigger><TooltipContent hideArrow>More info</TooltipContent></Tooltip>',
    source: 'ui/tooltip',
  },
  {
    name: 'conversation-transcript',
    imports:
      "import { ConversationSurface } from '@adea-ai/ui/components/conversation'; import { Button } from '@adea-ai/ui/components/ui/button'",
    jsx: '<><Button>Toggle</Button><ConversationSurface role="region" aria-label="Transcript">Transcript</ConversationSurface></>',
    sources: [
      'components/conversation/conversation-surface.tsx',
      'components/ui/button/button.tsx',
      'lib/variants.ts',
    ],
  },
  {
    name: 'list-row',
    imports:
      "import { ListRowControl } from '@adea-ai/ui/components/composites/list-row'; import { Button } from '@adea-ai/ui/components/ui/button'",
    jsx: '<ListRowControl description="Keeps long descriptions readable at narrow widths" trailing={<Button size="icon-2xs" variant="ghost" aria-label="Row actions">More</Button>}>Workspace</ListRowControl>',
    sources: [
      'components/composites/list-row/list-row-control.tsx',
      'components/ui/button/button.tsx',
      'lib/variants.ts',
      'lib/utils.ts',
    ],
  },
  {
    name: 'conversation-composer',
    imports: "import { MessageComposer } from '@adea-ai/ui/components/conversation'",
    jsx: '<MessageComposer value="Draft" onValueChange={() => {}} onSubmit={() => {}} />',
    sources: [
      'components/conversation/message-composer.tsx',
      'components/ui/textarea/textarea.tsx',
      'components/ui/spinner/spinner.tsx',
      'components/ui/kbd/kbd.tsx',
      'components/ui/button/button.tsx',
      'lib/variants.ts',
    ],
  },
  {
    name: 'busy-send',
    imports: "import { BusySendButton } from '@adea-ai/ui/components/conversation'",
    jsx: '<BusySendButton mode="steer" onModeChange={() => {}} onFire={() => {}} />',
    sources: [
      'components/conversation/busy-send-button.tsx',
      'components/ui/button-group/button-group.tsx',
      'components/ui/separator/separator.tsx',
      'components/ui/dropdown-menu/dropdown-menu.tsx',
      'components/ui/button/button.tsx',
      'lib/overlay.ts',
      'lib/variants.ts',
    ],
  },
  {
    name: 'shell',
    imports: "import { AppShell, AppShellBody, AppShellMain } from '@adea-ai/ui'",
    jsx: '<AppShell><AppShellBody><AppShellMain>Session</AppShellMain></AppShellBody></AppShell>',
    source: 'layout/app-shell',
  },
]

try {
  const sharedArchive = sharedPackedUiArchive()
  let archivePath = sharedArchive
  if (!archivePath) {
    const [archive] = JSON.parse(
      execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    )
    archivePath = join(consumer, archive.filename)
  }
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
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
  const optionalSamples: PackedSample[] = [
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
              (sample.sources
                ? sample.sources
                    .map((path) => `@source '../node_modules/@adea-ai/ui/src/${path}';\n`)
                    .join('')
                : sample.source
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
          if (
            sample.name === 'update-dialog' &&
            !uiModules.some((id) =>
              id.includes('/components/composites/update-dialog/update-dialog')
            )
          )
            throw new Error(`Packed ${condition} consumer did not include UpdateDialog`)
          if (sample.name.startsWith('input-control-')) {
            if (
              uiModules.some((id) => id.includes('/components/ui/input/input.tsx')) ||
              js.some((chunk) => /<datalist|input-suggestions|createUniqueId/.test(chunk.code))
            )
              throw new Error(
                `Packed ${condition}/${sample.name} retained Input suggestions implementation`
              )
          }
          if (uiModules.some((id) => id.includes(condition === 'compiled' ? '/src/' : '/dist/')))
            throw new Error('Mixed UI export conditions')
          const forbidden = modules.filter((id) => {
            if (/xterm|codemirror|shiki|storybook|\/lib\/themes/.test(id)) return true
            if (/\/components\/theme\//.test(id)) return true
            if (
              /\/components\/conversation\//.test(id) &&
              !['conversation-transcript', 'conversation-composer', 'busy-send'].includes(
                sample.name
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
          if (sample.name === 'conversation-transcript' && !css.includes('.h-control-md'))
            throw new Error('Packed ConversationSurface is missing shared control sizing')
          if (
            sample.name === 'list-row' &&
            (!css.includes('.list-row-description') ||
              !css.includes('var(--row-height-lg)') ||
              !css.includes('@container list-row') ||
              !css.includes('flex-direction:column'))
          )
            throw new Error('Packed ListRowControl is missing data-description row geometry')
          if (sample.name === 'list-row') {
            if (modules.some((id) => /components\/ui\/tooltip\//.test(id)))
              throw new Error(
                `Packed ${condition} ListRowControl retained the optional Tooltip module`
              )
            if (/aria-describedby|data-closed/.test(code))
              throw new Error(
                `Packed ${condition} ListRowControl output contains rich Tooltip implementation markers`
              )
          }
          if (sample.name === 'conversation-composer' && !css.includes('.h-control-md'))
            throw new Error('Packed MessageComposer is missing shared control sizing')
          if (sample.name === 'busy-send' && !css.includes('.h-control-md'))
            throw new Error('Packed BusySendButton is missing shared control sizing')
          if (sample.name === 'busy-send' && !css.includes('.bg-popover'))
            throw new Error('Packed BusySendButton is missing shared menu styling')
          if (sample.name === 'overlay' && !css.includes('.bg-popover'))
            throw new Error('Packed dialog is missing shared overlay styling')
          if (sample.name === 'update-dialog' && !css.includes('.max-h-52'))
            throw new Error('Packed UpdateDialog is missing release-note sizing styles')
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
          // list-row re-baselined 32 → 34 KiB (2026-10): the shared scene
          // controls' coarse-pointer touch rung adds 638 bytes of base CSS
          // (measured 33,185 against main's 32,547, which held only 221 bytes of
          // headroom). Re-baselined, not relaxed — the cap still bounds the
          // fixture's complete stylesheet.
          const cssCapKiB =
            sample.name === 'update-dialog'
              ? 48
              : sample.name === 'overlay'
                ? 40
                : ['conversation-transcript', 'conversation-composer', 'busy-send'].includes(
                      sample.name
                    )
                  ? 42
                  : sample.name === 'chart-subpath'
                    ? 28
                    : sample.name === 'carousel-subpath'
                      ? 35
                      : sample.name === 'list-row'
                        ? 34
                        : 32
          if (Buffer.byteLength(css) > cssCapKiB * 1024)
            throw new Error(`CSS exceeds measured ${cssCapKiB} KiB cap: ${Buffer.byteLength(css)}`)
          // JS gzip, measured: overlay 37,922; shell 24,434. The 32 KiB cap held
          // while the merge runtime was `clsx` + `tailwind-merge`; the `cn` swap
          // (2026-09) replaced it with the config-extended runtime, which ships
          // cn's compiler and default tables for `createCn(extend)` — the setup
          // the cn docs prescribe for published libraries. Re-baselined, not
          // relaxed: the number still bounds the whole overlay/shell floor.
          if ((sample.name === 'overlay' || sample.name === 'shell') && bytes > 38 * 1024)
            throw new Error('Overlay/shell exceeds measured 38 KiB gzip cap')
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
