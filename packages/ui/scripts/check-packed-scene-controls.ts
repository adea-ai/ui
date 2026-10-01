/** Actual packed-tarball checks for SceneControls and opt-in ActionButton touch targets. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import AxeBuilder from '@axe-core/playwright'
import { chromium, expect, webkit } from '@playwright/test'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

declare global {
  interface Window {
    sceneControlsFixture?: {
      unmount: () => void
      replaceMovementCallback: () => void
      disableMovement: () => void
      setLocalizedLabels: () => void
    }
    sceneControlsPointerId?: number
    sceneControlsPointerEvents?: string[]
  }
}

const packageRoot = resolve(import.meta.dir, '..')
const repoRoot = resolve(packageRoot, '../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-scene-controls-'))
const CONTROL_BUDGET = { gzip: 40 * 1024, css: 32 * 1024 }
const OVERLAY_BUDGET = { gzip: 38 * 1024, css: 40 * 1024 }
const optionalPeers = ['chart.js', 'solid-chartjs', 'embla-carousel', 'embla-carousel-solid']
const results: unknown[] = []
const budgetFailures: string[] = []
const behaviorFailures: string[] = []

function cssLayerBytes(css: string) {
  const bytes: Record<string, number> = {}
  let cursor = 0

  while (cursor < css.length) {
    const start = css.indexOf('@layer', cursor)
    if (start < 0) break
    const open = css.indexOf('{', start)
    const semicolon = css.indexOf(';', start)
    if (open < 0 || (semicolon >= 0 && semicolon < open)) {
      cursor = semicolon >= 0 && semicolon < open ? semicolon + 1 : css.length
      continue
    }

    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      if (css[end] === '}' && --depth === 0) {
        end++
        break
      }
    }
    const label =
      css
        .slice(start, open)
        .match(/^@layer\s+([^,{]+)/)?.[1]
        ?.trim() ?? 'unknown'
    bytes[label] = (bytes[label] ?? 0) + Buffer.byteLength(css.slice(start, end))
    cursor = end
  }

  return bytes
}

function rewriteFixture(relativePath: string, replacements: Array<[string, string]>) {
  let fixture = readFileSync(join(packageRoot, relativePath), 'utf8')
  for (const [sourceImport, packageImport] of replacements) {
    if (!fixture.includes(sourceImport))
      throw new Error(`Expected fixture import was missing from ${relativePath}: ${sourceImport}`)
    fixture = fixture.replaceAll(sourceImport, packageImport)
  }
  if (fixture.includes('../../src/'))
    throw new Error(`Packed fixture retained a source alias: ${relativePath}`)
  return fixture
}

const fixtures = [
  {
    name: 'scene-controls',
    source: rewriteFixture('tests/fixtures/scene-controls.tsx', [
      [
        '../../src/components/composites/scene-controls/scene-controls',
        '@adea-ai/ui/components/composites/scene-controls',
      ],
      ['../../src/components/ui/button/button', '@adea-ai/ui/components/ui/button'],
      ['../../src/styles/globals.css', './style.css'],
    ]),
    sources: [
      'composites/scene-controls/scene-controls.tsx',
      'composites/action-button/action-button.tsx',
      'ui/button/button.tsx',
      'ui/spinner/spinner.tsx',
      'ui/tooltip/tooltip.tsx',
      'lib/variants.ts',
      'lib/utils.ts',
    ],
  },
  {
    name: 'action-button-touch',
    source: rewriteFixture('tests/fixtures/action-button.tsx', [
      [
        '../../src/components/composites/action-button/action-button',
        '@adea-ai/ui/components/composites/action-button',
      ],
      ['../../src/components/ui/button/button', '@adea-ai/ui/components/ui/button'],
      [
        '../../src/components/ui/dropdown-menu/dropdown-menu',
        '@adea-ai/ui/components/ui/dropdown-menu',
      ],
      ['../../src/components/ui/popover/popover', '@adea-ai/ui/components/ui/popover'],
      ['../../src/styles/globals.css', './style.css'],
    ]),
    sources: [
      'composites/action-button/action-button.tsx',
      'ui/button/button.tsx',
      'ui/dropdown-menu/dropdown-menu.tsx',
      'ui/popover/popover.tsx',
      'ui/spinner/spinner.tsx',
      'ui/tooltip/tooltip.tsx',
      'lib/overlay.ts',
      'lib/utils.ts',
      'lib/variants.ts',
    ],
  },
] as const

async function reportCssBaselines() {
  const probes = [
    {
      name: 'theme-base-only',
      source: `import './style.css'\nimport { render } from 'solid-js/web'\nrender(() => <main />, document.getElementById('app')!)`,
      sources: [],
    },
    {
      name: 'button-only',
      source: `import './style.css'\nimport { render } from 'solid-js/web'\nimport { Button } from '@adea-ai/ui/components/ui/button'\nrender(() => <Button>Open</Button>, document.getElementById('app')!)`,
      sources: ['ui/button/button.tsx', 'lib/variants.ts', 'lib/utils.ts'],
    },
    {
      name: 'action-button-tooltip',
      source: `import './style.css'\nimport { render } from 'solid-js/web'\nimport { ActionButton } from '@adea-ai/ui/components/composites/action-button'\nrender(() => <ActionButton aria-label="Help" tooltip="Helpful details">Help</ActionButton>, document.getElementById('app')!)`,
      sources: [
        'composites/action-button/action-button.tsx',
        'ui/button/button.tsx',
        'ui/spinner/spinner.tsx',
        'ui/tooltip/tooltip.tsx',
        'lib/variants.ts',
        'lib/utils.ts',
      ],
    },
  ]

  for (const probe of probes) {
    const dir = join(consumer, `css-baseline-${probe.name}`)
    mkdirSync(dir)
    writeFileSync(
      join(dir, 'index.html'),
      '<div id="app"></div><script type="module" src="/main.tsx"></script>'
    )
    writeFileSync(join(dir, 'main.tsx'), probe.source)
    writeFileSync(
      join(dir, 'style.css'),
      [
        "@import 'tailwindcss' source(none);",
        "@import '@adea-ai/ui/theme.css';",
        "@import '@adea-ai/ui/base.css';",
        "@source './main.tsx';",
        ...probe.sources.map((source) => {
          const packagePath = source.startsWith('lib/')
            ? `src/${source}`
            : `src/components/${source}`
          return `@source '../node_modules/@adea-ai/ui/${packagePath}';`
        }),
        '',
      ].join('\n')
    )
    const output = await build({
      root: dir,
      configFile: false,
      logLevel: 'warn',
      plugins: [
        solid(),
        tailwindcss(),
        {
          name: 'packed-compiled-condition',
          enforce: 'post',
          configEnvironment(_name: string, config: EnvironmentOptions) {
            config.resolve ??= {}
            config.resolve.conditions = (config.resolve.conditions ?? []).filter(
              (item) => item !== 'solid' && item !== 'development'
            )
          },
        },
      ],
      resolve: { conditions: ['browser', 'import'] },
      build: { write: false, minify: 'esbuild', target: 'esnext', modulePreload: false },
    })
    const chunks = (Array.isArray(output) ? output : [output]).flatMap((item) =>
      'output' in item ? item.output : []
    )
    const js = chunks.filter((item) => item.type === 'chunk')
    const css = chunks
      .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
      .map((item) => (item.type === 'asset' ? String(item.source) : ''))
      .join('\n')
    const modules = js.flatMap((chunk) => Object.keys(chunk.modules))
    console.log(
      JSON.stringify({
        cssBaseline: probe.name,
        css: Buffer.byteLength(css),
        cssGzip: gzipSync(css).length,
        jsChunks: js.length,
        modules,
        cssLayerBytes: cssLayerBytes(css),
        cssOutsideNamedLayers:
          Buffer.byteLength(css) -
          Object.values(cssLayerBytes(css)).reduce((sum, size) => sum + size, 0),
      })
    )
  }
}

console.log(JSON.stringify({ owner: 'packed-scene-controls', runnerPid: process.pid, consumer }))

try {
  const suppliedArchive = sharedPackedUiArchive()
  let archivePath = suppliedArchive
  if (!archivePath) {
    const [archive] = JSON.parse(
      execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
        cwd: packageRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    ) as [{ filename: string }]
    if (!archive?.filename) throw new Error('npm pack did not return a tarball')
    archivePath = join(consumer, archive.filename)
  }

  const localManifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    dependencies?: Record<string, string>
  }
  const solidVersion = localManifest.peerDependencies?.['solid-js']
  if (!solidVersion || localManifest.dependencies?.['solid-js'])
    throw new Error('SolidJS must remain an external package peer')
  const tailwindVersion = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules/tailwindcss/package.json'), 'utf8')
  ).version as string
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
        'solid-js': solidVersion,
        tailwindcss: tailwindVersion,
      },
    })
  )
  execFileSync(
    'bun',
    [
      'install',
      '--ignore-scripts',
      '--omit',
      'optional',
      '--cache-dir',
      join(consumer, 'bun-cache'),
    ],
    { cwd: consumer, stdio: 'inherit' }
  )

  const packedRoot = join(consumer, 'node_modules/@adea-ai/ui')
  const packedManifest = JSON.parse(readFileSync(join(packedRoot, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    dependencies?: Record<string, string>
  }
  if (!packedManifest.peerDependencies?.['solid-js'] || packedManifest.dependencies?.['solid-js'])
    throw new Error('Packed UI manifest does not externalize SolidJS as a peer')
  for (const peer of optionalPeers) {
    if (existsSync(join(consumer, 'node_modules', peer)))
      throw new Error(`Unused optional peer was installed: ${peer}`)
  }
  for (const name of ['LICENSE', 'NOTICE']) {
    const packed = readFileSync(join(packedRoot, 'dist', name), 'utf8')
    if (packed !== readFileSync(join(repoRoot, name), 'utf8'))
      throw new Error(`Packed ${name} differs from repository attribution`)
  }

  const typeConsumer = join(consumer, 'scene-controls-consumer.tsx')
  writeFileSync(
    typeConsumer,
    `import type { ComponentProps } from 'solid-js'
import { SceneControls, type SceneMovementDirection } from '@adea-ai/ui/components/composites/scene-controls'
import { ActionButton } from '@adea-ai/ui/components/composites/action-button'

const controls: ComponentProps<typeof SceneControls> = {
  onMovementChange: (direction: SceneMovementDirection, pressed: boolean) => {
    const held: Record<SceneMovementDirection, boolean> = {
      forward: pressed,
      left: pressed,
      backward: pressed,
      right: pressed,
    }
    void held[direction]
  },
  onJumpChange: (pressed: boolean) => { void pressed },
  onZoomIn: () => undefined,
  onZoomOut: () => undefined,
  labels: { forward: 'Avanzar', forwardTooltip: 'Mantén para avanzar' },
}

export function PackedSceneControlsConsumer() {
  return <>
    <SceneControls {...controls} />
    <ActionButton size="icon-md" touchTarget="comfortable" aria-label="Open action">
      Action
    </ActionButton>
  </>
}
`
  )
  const typeConfig = join(consumer, 'scene-controls-tsconfig.json')
  writeFileSync(
    typeConfig,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        noEmit: true,
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
      },
      include: [typeConsumer],
    })
  )
  execFileSync(join(repoRoot, 'node_modules/.bin/tsc'), ['--project', typeConfig], {
    cwd: consumer,
    stdio: 'inherit',
  })

  if (process.env.ADEA_PACKED_UI_CSS_BASELINES === '1') await reportCssBaselines()

  for (const fixture of fixtures) {
    for (const condition of ['compiled', 'solid'] as const) {
      const dir = join(consumer, `${fixture.name}-${condition}`)
      mkdirSync(dir)
      writeFileSync(
        join(dir, 'index.html'),
        '<div id="app"></div><script type="module" src="/main.tsx"></script>'
      )
      writeFileSync(join(dir, 'main.tsx'), fixture.source)
      writeFileSync(
        join(dir, 'style.css'),
        [
          "@import 'tailwindcss' source(none);",
          "@import '@adea-ai/ui/theme.css';",
          "@import '@adea-ai/ui/base.css';",
          "@source './main.tsx';",
          ...fixture.sources.map((source) => {
            const packagePath = source.startsWith('lib/')
              ? `src/${source}`
              : `src/components/${source}`
            return `@source '../node_modules/@adea-ai/ui/${packagePath}';`
          }),
          '',
        ].join('\n')
      )
      const output = await build({
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
                      (item) => item !== 'solid' && item !== 'development'
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
      const outputs = Array.isArray(output) ? output : [output]
      const chunks = outputs.flatMap((item) => ('output' in item ? item.output : []))
      const js = chunks.filter((item) => item.type === 'chunk')
      if (js.length !== 1)
        throw new Error(`${fixture.name}/${condition} emitted multiple JS chunks`)
      const chunk = js[0]
      if (!chunk) throw new Error(`Missing ${fixture.name}/${condition} chunk`)
      const modules = Object.keys(chunk.modules).filter((id) => chunk.modules[id]?.renderedLength)
      const uiModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
      const expectedCondition = condition === 'solid' ? '/src/' : '/dist/'
      const otherCondition = condition === 'solid' ? '/dist/' : '/src/'
      if (!uiModules.some((id) => id.includes(expectedCondition)))
        throw new Error(`${fixture.name} selected the wrong ${condition} export condition`)
      if (uiModules.some((id) => id.includes(otherCondition)))
        throw new Error(`${fixture.name} mixed compiled and Solid export conditions`)
      const allowedUi =
        fixture.name === 'scene-controls'
          ? /\/components\/(?:composites\/(?:scene-controls|action-button)|ui\/(?:button|spinner|tooltip))\/|\/lib\/(?:utils|variants)\./
          : /\/components\/(?:composites\/action-button|ui\/(?:button|dropdown-menu|popover|spinner|tooltip))\/|\/lib\/(?:overlay|utils|variants)\./
      const unrelatedUi = uiModules.filter((id) => !allowedUi.test(id))
      if (unrelatedUi.length)
        throw new Error(`${fixture.name} retained unrelated UI modules: ${unrelatedUi.join(', ')}`)
      const forbidden = modules.filter((id) =>
        /chart\.js|solid-chartjs|embla-carousel|xterm|codemirror|shiki|storybook|lucide-react|@fortawesome|@heroicons|phosphor|react-icons|iconoir|registry\.json|fontsource|\/lib\/themes/.test(
          id
        )
      )
      if (forbidden.length)
        throw new Error(`${fixture.name} retained forbidden modules: ${forbidden.join(', ')}`)
      const allowedIcons = new Set(
        fixture.name === 'scene-controls'
          ? [
              'arrow-down',
              'arrow-left',
              'arrow-right',
              'arrow-up',
              'loader-circle',
              'zoom-in',
              'zoom-out',
            ]
          : ['check', 'chevron-right', 'circle', 'loader-circle', 'more-horizontal', 'plus']
      )
      const unexpectedIcons = modules.filter((id) => {
        const icon = id.match(/\/lucide-solid\/.*\/icons\/([^/]+)\.js$/)?.[1]
        return icon !== undefined && !allowedIcons.has(icon)
      })
      if (unexpectedIcons.length)
        throw new Error(
          `${fixture.name} retained unrelated Lucide icons: ${unexpectedIcons.join(', ')}`
        )
      const solidRoots = new Set(
        modules
          .filter((id) => id.includes('/node_modules/solid-js/'))
          .map((id) =>
            id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
          )
      )
      if (solidRoots.size !== 1)
        throw new Error(`Expected one Solid runtime, got ${solidRoots.size}`)
      if (chunks.some((item) => /\.woff2?$/.test(item.fileName)))
        throw new Error('Packed controls unexpectedly emitted a font asset')
      const code = chunk.code
      const css = chunks
        .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
        .map((item) => (item.type === 'asset' ? String(item.source) : ''))
        .join('\n')
      const gzip = gzipSync(code).length
      console.log(
        JSON.stringify({
          fixture: fixture.name,
          condition,
          js: Buffer.byteLength(code),
          gzip,
          css: Buffer.byteLength(css),
          modules: modules.length,
          uiModules: uiModules.map((id) => ({
            id: id.split('/node_modules/@adea-ai/ui/')[1],
            renderedLength: chunk.modules[id]?.renderedLength,
          })),
          dependencyModules: modules
            .filter(
              (id) => id.includes('/node_modules/') && !id.includes('/node_modules/@adea-ai/ui/')
            )
            .map((id) => ({
              id: id.split('/node_modules/')[1],
              renderedLength: chunk.modules[id]?.renderedLength,
            })),
          cssLayerBytes: cssLayerBytes(css),
          cssOutsideNamedLayers:
            Buffer.byteLength(css) -
            Object.values(cssLayerBytes(css)).reduce((sum, size) => sum + size, 0),
        })
      )
      const diagnosticsDir = process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR
      if (diagnosticsDir) {
        mkdirSync(diagnosticsDir, { recursive: true })
        writeFileSync(join(diagnosticsDir, `${fixture.name}-${condition}.css`), css)
      }
      const budget = fixture.name === 'scene-controls' ? CONTROL_BUDGET : OVERLAY_BUDGET
      if (gzip > budget.gzip)
        budgetFailures.push(
          `${fixture.name}/${condition} exceeds its existing ${budget.gzip / 1024} KiB gzip cap: ${gzip}`
        )
      if (Buffer.byteLength(css) > budget.css)
        budgetFailures.push(
          `${fixture.name}/${condition} exceeds its existing ${budget.css / 1024} KiB CSS cap: ${Buffer.byteLength(css)}`
        )
      if (fixture.name === 'scene-controls' && !css.includes('.h-control-2xl'))
        throw new Error('Packed SceneControls lost its stable 2xl control sizing utility')
      if (fixture.name === 'action-button-touch' && !css.includes('.touch-target-comfortable'))
        throw new Error('Packed ActionButton lost its opt-in touch target utility')

      for (const [engine, browserType] of [
        ['chromium', chromium],
        ['webkit', webkit],
      ] as const) {
        try {
          const browser = await browserType.launch({ headless: true })
          const context = await browser.newContext({
            viewport: { width: 320, height: 640 },
            hasTouch: true,
            isMobile: true,
          })
          try {
            const page = await context.newPage()
            const errors: string[] = []
            page.on('pageerror', (error) => errors.push(error.message))
            await page.setContent(
              '<!doctype html><html lang="en"><head><title>Packed shared controls</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'
            )
            await page.addStyleTag({ content: css })
            await page.addScriptTag({ type: 'module', content: code })
            await page.addStyleTag({
              content: 'html { font-size: 200% !important; } body { margin: 0; }',
            })
            await page.evaluate(() =>
              document.documentElement.setAttribute('data-density', 'compact')
            )
            if (fixture.name === 'scene-controls') {
              const groups = [
                page.getByRole('group', { name: 'Scene movement controls' }),
                page.getByRole('group', { name: 'Camera zoom' }),
              ]
              for (const group of groups) {
                const bounds = await group.boundingBox()
                expect(bounds).not.toBeNull()
                expect(bounds!.width).toBeLessThanOrEqual(320)
                expect(bounds!.height).toBeGreaterThanOrEqual(96)
                expect(bounds!.x).toBeGreaterThanOrEqual(0)
                expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
                expect(bounds!.y).toBeGreaterThanOrEqual(0)
                expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640)
              }
              const movement = groups[0]!
              const controls = [
                ...(await movement.getByRole('button').all()),
                ...(await groups[1]!.getByRole('button').all()),
                page.getByRole('button', { name: 'Jump' }),
              ]
              for (const control of controls) {
                const bounds = await control.boundingBox()
                expect(bounds).not.toBeNull()
                expect(bounds!.width).toBeGreaterThanOrEqual(96)
                expect(bounds!.height).toBeGreaterThanOrEqual(96)
                expect(bounds!.x).toBeGreaterThanOrEqual(0)
                expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
                expect(bounds!.y).toBeGreaterThanOrEqual(0)
                expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640)
                const icon = await control.locator('svg').boundingBox()
                expect(icon).not.toBeNull()
                expect(icon!.width).toBeGreaterThanOrEqual(24)
                expect(icon!.height).toBeGreaterThanOrEqual(24)
                expect(icon!.x).toBeGreaterThanOrEqual(bounds!.x)
                expect(icon!.y).toBeGreaterThanOrEqual(bounds!.y)
                expect(icon!.x + icon!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
                expect(icon!.y + icon!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height)
              }
              await page.evaluate(() => window.sceneControlsFixture?.setLocalizedLabels())
              const forward = page.getByRole('button', { name: 'Avanzar' })
              await expect(forward).toHaveAttribute('aria-label', 'Avanzar')
              if (process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR) {
                console.log(
                  JSON.stringify({
                    fixture: fixture.name,
                    condition,
                    stage: 'localized-label',
                    name: await forward.getAttribute('aria-label'),
                    active: await forward.evaluate((element) => element === document.activeElement),
                  })
                )
              }
              await forward.hover()
              const tooltip = page.getByRole('tooltip')
              await expect(tooltip).toHaveText('Mantén para avanzar')
              const tooltipBounds = await tooltip.boundingBox()
              expect(tooltipBounds).not.toBeNull()
              expect(tooltipBounds!.x).toBeGreaterThanOrEqual(0)
              expect(tooltipBounds!.x + tooltipBounds!.width).toBeLessThanOrEqual(320)
              await page.mouse.move(0, 0)
              await expect(tooltip).toBeHidden()
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth)
              ).toBeLessThanOrEqual(320)
              expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

              const events = page.getByLabel('Interaction events')
              const reportInteractionStage = async (stage: string) => {
                if (!process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR) return
                console.log(
                  JSON.stringify({
                    fixture: fixture.name,
                    condition,
                    stage,
                    events: await events.textContent(),
                    replacementEvents: await page.getByLabel('Replacement events').textContent(),
                    name: await forward.getAttribute('aria-label'),
                    active: await forward.evaluate((element) => element === document.activeElement),
                  })
                )
              }
              await forward.focus()
              if (process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR) {
                console.log(
                  JSON.stringify({
                    fixture: fixture.name,
                    condition,
                    stage: 'focused-before-space',
                    name: await forward.getAttribute('aria-label'),
                    active: await forward.evaluate((element) => element === document.activeElement),
                  })
                )
              }
              await page.keyboard.down('Space')
              await page.keyboard.down('Space')
              if (process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR) {
                console.log(
                  JSON.stringify({
                    fixture: fixture.name,
                    condition,
                    stage: 'after-space',
                    events: await events.textContent(),
                    activeLabel: await page.evaluate(() =>
                      document.activeElement?.getAttribute('aria-label')
                    ),
                  })
                )
              }
              await expect(events).toHaveText('forward:down')
              await page.keyboard.up('Space')
              await reportInteractionStage('space-up')
              await expect(events).toHaveText('forward:down,forward:up')
              await page.keyboard.down('Enter')
              await reportInteractionStage('enter-down')
              await expect(events).toHaveText('forward:down,forward:up,forward:down')
              await page.evaluate(() => window.dispatchEvent(new Event('blur')))
              await reportInteractionStage('window-blur')
              await expect(events).toHaveText('forward:down,forward:up,forward:down,forward:up')
              await page.keyboard.up('Enter')
              await page.keyboard.down('Space')
              await reportInteractionStage('second-space-down')
              await expect(events).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down'
              )
              await page.evaluate(() => window.sceneControlsFixture?.replaceMovementCallback())
              await reportInteractionStage('callback-replaced')
              await page.keyboard.up('Space')
              await reportInteractionStage('space-up-after-callback-replacement')
              await expect(events).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down,forward:up'
              )
              await expect(page.getByLabel('Replacement events')).toBeEmpty()
              await page.getByRole('button', { name: 'Zoom in' }).click()
              await reportInteractionStage('zoom-click')
              await expect(page.getByLabel('Zoom activations')).toHaveText('1')

              await forward.hover()
              await page.mouse.down()
              const replacementEvents = page.getByLabel('Replacement events')
              await expect(replacementEvents).toHaveText('forward:down')
              await page.mouse.up()
              await expect(replacementEvents).toHaveText('forward:down,forward:up')
              await page.evaluate(() => {
                window.sceneControlsPointerEvents = []
                window.sceneControlsPointerId = undefined
                window.addEventListener(
                  'pointerdown',
                  (event) => {
                    window.sceneControlsPointerId = event.pointerId
                    window.sceneControlsPointerEvents?.push(
                      `down:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
                    )
                  },
                  { capture: true, once: true }
                )
                for (const eventName of [
                  'gotpointercapture',
                  'lostpointercapture',
                  'pointermove',
                  'pointerup',
                ] as const) {
                  window.addEventListener(
                    eventName,
                    (event) =>
                      window.sceneControlsPointerEvents?.push(
                        `${eventName === 'pointermove' ? 'move' : eventName === 'pointerup' ? 'up' : eventName === 'gotpointercapture' ? 'got' : 'lost'}:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
                      ),
                    { capture: true }
                  )
                }
              })
              await page.mouse.down()
              await expect(replacementEvents).toHaveText('forward:down,forward:up,forward:down')
              const pointerId = await page.evaluate(() => window.sceneControlsPointerId)
              if (typeof pointerId !== 'number')
                throw new Error('Packed SceneControls pointerdown did not record an id')
              expect(
                await forward.evaluate(
                  (element: HTMLButtonElement, id) => element.hasPointerCapture(id),
                  pointerId
                )
              ).toBe(true)
              const forwardBounds = await forward.boundingBox()
              expect(forwardBounds).not.toBeNull()
              await page.mouse.move(
                forwardBounds!.x + forwardBounds!.width / 2 + 1,
                forwardBounds!.y + forwardBounds!.height / 2 + 1
              )
              expect(await page.evaluate(() => window.sceneControlsPointerEvents ?? [])).toEqual([
                `down:${pointerId}:forward`,
                `got:${pointerId}:forward`,
                `move:${pointerId}:forward`,
              ])
              await page
                .getByRole('button', { name: 'Capture transfer target' })
                .evaluate(
                  (element: HTMLButtonElement, id) => element.setPointerCapture(id),
                  pointerId
                )
              await page.mouse.move(
                forwardBounds!.x + forwardBounds!.width + 8,
                forwardBounds!.y + forwardBounds!.height + 8
              )
              expect(await page.evaluate(() => window.sceneControlsPointerEvents ?? [])).toEqual([
                `down:${pointerId}:forward`,
                `got:${pointerId}:forward`,
                `move:${pointerId}:forward`,
                `lost:${pointerId}:forward`,
                `got:${pointerId}:scene-controls-capture-transfer`,
                `move:${pointerId}:scene-controls-capture-transfer`,
              ])
              await expect(replacementEvents).toHaveText(
                'forward:down,forward:up,forward:down,forward:up'
              )
              await page.mouse.up()
              expect(await page.evaluate(() => window.sceneControlsPointerEvents?.at(-1))).toBe(
                `lost:${pointerId}:scene-controls-capture-transfer`
              )
              await forward.hover()
              await page.mouse.down()
              await expect(replacementEvents).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down'
              )
              await forward.dispatchEvent('pointercancel', { pointerId, pointerType: 'mouse' })
              await expect(replacementEvents).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down,forward:up'
              )
              await page.mouse.up()
              await page.mouse.down()
              await expect(replacementEvents).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down,forward:up,forward:down'
              )
              await page.evaluate(() => window.sceneControlsFixture?.unmount())
              await expect(forward).toHaveCount(0)
              await expect(replacementEvents).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down,forward:up,forward:down,forward:up'
              )
              await page.mouse.up()
              await page.evaluate(() => window.dispatchEvent(new Event('blur')))
              await expect(replacementEvents).toHaveText(
                'forward:down,forward:up,forward:down,forward:up,forward:down,forward:up,forward:down,forward:up'
              )

              const removalPage = await context.newPage()
              await removalPage.setContent(
                '<!doctype html><html lang="en"><head><title>Packed shared controls</title></head><body></body></html>'
              )
              await removalPage.addStyleTag({ content: css })
              await removalPage.addStyleTag({
                content: 'html { font-size: 200% !important; } body { margin: 0; }',
              })
              await removalPage.addScriptTag({ type: 'module', content: code })
              const removableForward = removalPage.getByRole('button', { name: 'Move forward' })
              const removalEvents = removalPage.getByLabel('Interaction events')
              await removableForward.hover()
              if (process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR) {
                console.log(
                  JSON.stringify({
                    fixture: fixture.name,
                    condition,
                    engine,
                    stage: 'removal-before-pointer-down',
                    active: await removableForward.evaluate(
                      (element) => element === document.activeElement
                    ),
                    fixtureReady: await removalPage.evaluate(
                      () => typeof window.sceneControlsFixture?.disableMovement === 'function'
                    ),
                  })
                )
              }
              await removalPage.mouse.down()
              if (process.env.ADEA_PACKED_UI_DIAGNOSTICS_DIR) {
                console.log(
                  JSON.stringify({
                    fixture: fixture.name,
                    condition,
                    engine,
                    stage: 'removal-after-pointer-down',
                    events: await removalEvents.textContent(),
                  })
                )
              }
              await expect(removalEvents).toHaveText('forward:down')
              await removalPage.evaluate(() => window.sceneControlsFixture?.disableMovement())
              await expect(
                removalPage.getByRole('group', { name: 'Scene movement controls' })
              ).toHaveCount(0)
              await expect(removalEvents).toHaveText('forward:down,forward:up')
              await removalPage.mouse.up()
              await expect(removalEvents).toHaveText('forward:down,forward:up')
              results.push({
                fixture: fixture.name,
                condition,
                engine,
                checks: [
                  'compact-200-percent-targets',
                  'icon-and-tooltip-containment',
                  'localized-label-and-hold-tooltip',
                  'axe',
                  'keyboard-held-pairs',
                  'original-callback-release',
                  'zoom-activation',
                  'pointer-up-lost-capture-and-cancel',
                  'pointer-capture-cleanup',
                  'movement-capability-removal',
                ],
              })
            } else {
              if (!(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)))
                throw new Error('Touch fixture did not expose a coarse pointer')
              const targets = [
                '#touch-target-plain',
                '#touch-target-tooltip',
                '#touch-target-polymorphic-tooltip',
                '#touch-target-menu-trigger',
              ]
              for (const selector of targets) {
                const target = page.locator(selector)
                await expect(target).toBeVisible()
                await expect(target).not.toHaveAttribute('touchtarget')
                const bounds = await target.boundingBox()
                expect(bounds).not.toBeNull()
                expect(bounds!.width).toBeGreaterThanOrEqual(96)
                expect(bounds!.height).toBeGreaterThanOrEqual(96)
                expect(bounds!.x).toBeGreaterThanOrEqual(0)
                expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
                expect(bounds!.y).toBeGreaterThanOrEqual(0)
                expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640)
                const icon = await target.locator('svg').boundingBox()
                expect(icon).not.toBeNull()
                expect(icon!.width).toBeGreaterThanOrEqual(24)
                expect(icon!.height).toBeGreaterThanOrEqual(24)
                expect(icon!.x).toBeGreaterThanOrEqual(bounds!.x)
                expect(icon!.y).toBeGreaterThanOrEqual(bounds!.y)
                expect(icon!.x + icon!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
                expect(icon!.y + icon!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height)
              }
              const plain = page.locator('#touch-target-plain')
              expect(
                await plain.locator('svg').evaluate((icon) => icon.getBoundingClientRect().width)
              ).toBe(32)
              await plain.focus()
              await expect(plain).toBeFocused()
              const ordinaryTooltip = page.getByRole('button', { name: 'Tooltip action' })
              await ordinaryTooltip.focus()
              await expect(page.getByRole('tooltip')).toHaveText('Open action details')
              const polymorphic = page.getByRole('link', { name: 'Polymorphic tooltip link' })
              await polymorphic.focus()
              await expect(page.getByRole('tooltip')).toHaveText('Open the linked action details')
              const menuTrigger = page.getByRole('button', { name: 'Open comfortable menu' })
              await menuTrigger.focus()
              await page.keyboard.press('Enter')
              await expect(page.getByRole('menuitem', { name: 'Open settings' })).toBeFocused()
              await page.keyboard.press('Escape')
              await expect(menuTrigger).toBeFocused()
              await expect(page.getByRole('menuitem')).toHaveCount(0)
              await expect(page.getByRole('tooltip')).toHaveCount(0)
              expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth)
              ).toBeLessThanOrEqual(320)
              results.push({
                fixture: fixture.name,
                condition,
                engine,
                checks: [
                  'four-96px-touch-targets',
                  'retained-glyph-size',
                  'keyboard-focus',
                  'tooltip-focus',
                  'menu-return-focus',
                  'no-horizontal-overflow',
                ],
              })
            }
            if (errors.length)
              throw new Error(
                `${fixture.name}/${condition}/${engine} browser errors: ${errors.join(', ')}`
              )
          } finally {
            await context.close()
            await browser.close()
          }
        } catch (error) {
          const message = `${fixture.name}/${condition}/${engine}: ${error instanceof Error ? error.message : String(error)}`
          behaviorFailures.push(message)
          console.error(message)
        }
      }
    }
  }

  // The compiled export targets the browser DOM runtime. Native Node SSR must
  // exercise the published Solid source condition instead of pretending the
  // browser-only bundle is a server entry.
  for (const condition of ['solid'] as const) {
    const ssrDirectory = join(consumer, `scene-controls-ssr-${condition}`)
    mkdirSync(ssrDirectory)
    const ssrEntry = join(ssrDirectory, 'scene-controls-ssr.tsx')
    writeFileSync(
      ssrEntry,
      `import { renderToString } from 'solid-js/web'
import { SceneControls } from '@adea-ai/ui/components/composites/scene-controls'

export const renderSceneControls = () => renderToString(() => <SceneControls
  onMovementChange={() => undefined}
  onJumpChange={() => undefined}
  onZoomIn={() => undefined}
  onZoomOut={() => undefined}
/>)
`
    )
    const output = await build({
      root: consumer,
      configFile: false,
      logLevel: 'warn',
      plugins: [solid({ ssr: true })],
      resolve: {
        conditions: ['solid', 'node', 'import'],
      },
      ssr: { noExternal: true },
      build: { write: false, minify: false, ssr: ssrEntry },
    })
    const outputs = Array.isArray(output) ? output : [output]
    const serverChunks = outputs
      .flatMap((item) => ('output' in item ? item.output : []))
      .filter((item) => item.type === 'chunk')
    if (serverChunks.length !== 1)
      throw new Error(`SceneControls SSR emitted multiple chunks (${condition})`)
    const serverChunk = serverChunks[0]
    if (!serverChunk) throw new Error(`SceneControls SSR chunk missing (${condition})`)
    const serverUi = Object.keys(serverChunk.modules).filter((id) =>
      id.includes('/node_modules/@adea-ai/ui/')
    )
    const expected = '/src/'
    const other = '/dist/'
    if (!serverUi.some((id) => id.includes(expected)) || serverUi.some((id) => id.includes(other)))
      throw new Error(`SceneControls SSR selected mixed/wrong ${condition} package exports`)
    const renderedServer = join(consumer, 'node_modules/.cache/scene-controls-ssr')
    mkdirSync(renderedServer, { recursive: true })
    writeFileSync(join(renderedServer, 'server.mjs'), serverChunk.code)
    writeFileSync(
      join(renderedServer, 'render.mjs'),
      "import { renderSceneControls } from './server.mjs'; process.stdout.write(renderSceneControls());"
    )
    const markup = execFileSync('node', [join(renderedServer, 'render.mjs')], {
      cwd: consumer,
      encoding: 'utf8',
    })
    for (const label of [
      'Scene movement controls',
      'Move forward',
      'Jump',
      'Camera zoom',
      'Zoom in',
    ]) {
      if (!markup.includes(label))
        throw new Error(`Native SSR omitted SceneControls label: ${label}`)
    }
    results.push({
      fixture: 'scene-controls-ssr',
      condition,
      checks: ['native-node-render', 'accessible-controls-present'],
      modules: serverUi.length,
    })
  }

  console.log(JSON.stringify({ results }, null, 2))
  if (budgetFailures.length || behaviorFailures.length)
    throw new Error([...budgetFailures, ...behaviorFailures].join('\n'))
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
