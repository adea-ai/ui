/** Actual npm-tarball, SSR, Chromium and WebKit contract for TranscriptComposition. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import AxeBuilder from '@axe-core/playwright'
import { chromium, webkit, expect, type BrowserContext } from '@playwright/test'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'

const root = resolve(import.meta.dir, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-packed-transcript-'))
const MAX_GZIP_BYTES = 26 * 1024
const MAX_CSS_BYTES = 42 * 1024
console.log(`Owned transcript pilot runner PID: ${process.pid}`)

try {
  const [archive] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
  ) as [{ filename: string }]
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    peerDependencies: Record<string, string>
  }
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
  execFileSync('bun', ['install', '--ignore-scripts', '--omit=optional'], {
    cwd: consumer,
    stdio: 'pipe',
    timeout: 120_000,
  })
  for (const optional of ['chart.js', 'solid-chartjs', 'embla-carousel', 'embla-carousel-solid']) {
    if (existsSync(join(consumer, 'node_modules', optional)))
      throw new Error(`Optional engine installed in core transcript: ${optional}`)
  }
  const packageRoot = join(consumer, 'node_modules/@adea-ai/ui')
  const notice = readFileSync(join(packageRoot, 'dist/NOTICE'), 'utf8')
  if (!notice.includes('Shared transcript composition translated from KiroCrew'))
    throw new Error('Packed NOTICE lost the transcript attribution')
  if (!readFileSync(join(packageRoot, 'dist/LICENSE'), 'utf8').includes('Apache License'))
    throw new Error('Packed LICENSE missing')
  for (const path of [
    'dist/components/conversation/transcript-composition.js',
    'dist/components/conversation/transcript-composition.d.ts',
    'src/components/conversation/transcript-composition.tsx',
  ]) {
    if (!existsSync(join(packageRoot, path)))
      throw new Error(`Packed subpath file missing: ${path}`)
  }

  const serverEntry = join(consumer, 'server-entry.tsx')
  writeFileSync(
    serverEntry,
    `import { renderToString } from 'solid-js/web';
import { TranscriptComposition } from '@adea-ai/ui/components/conversation/transcript-composition';
const rows = [
 {id:'prompt',value:'Question',opensTurn:'reset'},
 {id:'request',value:'Tool request',fold:'tool',call:{phase:'request',id:'call-1'}},
 {id:'result',value:'Tool result',fold:'tool',call:{phase:'result',id:'call-1'}},
 {id:'approval',value:'Pending approval',fold:'tool',alwaysVisible:true},
 {id:'answer',value:'Final answer',fold:'prose',conclusion:true},
];
export const renderTranscript = () => renderToString(() =>
 <TranscriptComposition rows={rows} renderRow={props => <article>{props.row.value}</article>} />
);
`
  )
  const serverBuild = await build({
    root: consumer,
    configFile: false,
    logLevel: 'warn',
    plugins: [solid({ ssr: true })],
    resolve: { conditions: ['solid', 'node', 'import'] },
    ssr: { noExternal: true },
    build: { write: false, minify: false, ssr: serverEntry },
  })
  const serverChunks = (Array.isArray(serverBuild) ? serverBuild : [serverBuild])
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((asset) => asset.type === 'chunk')
  if (serverChunks.length !== 1) throw new Error('Expected one packed transcript SSR chunk')
  const serverChunk = serverChunks[0]
  if (!serverChunk) throw new Error('Missing packed transcript SSR chunk')
  const serverModules = Object.keys(serverChunk.modules)
  const serverUi = serverModules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
  if (!serverUi.some((id) => id.includes('/src/')) || serverUi.some((id) => id.includes('/dist/')))
    throw new Error('Packed transcript SSR did not select unmixed Solid source')
  writeFileSync(join(consumer, 'server-fixture.mjs'), serverChunk.code)
  writeFileSync(
    join(consumer, 'render.mjs'),
    "import { renderTranscript } from './server-fixture.mjs'; process.stdout.write(renderTranscript());"
  )
  const serverHtml = execFileSync('node', [join(consumer, 'render.mjs')], {
    cwd: consumer,
    encoding: 'utf8',
    timeout: 30_000,
  })
  for (const text of ['Question', 'Pending approval', 'Final answer', 'Show 1 tool call']) {
    if (!serverHtml.includes(text)) throw new Error(`Packed SSR omitted ${text}`)
  }
  if (serverHtml.includes('Tool request') || serverHtml.includes('Tool result'))
    throw new Error('Default settled tool fold mounted hidden tool rows in SSR')

  for (const condition of ['compiled', 'solid'] as const) {
    const pilot = join(consumer, condition)
    mkdirSync(pilot)
    const sourceFixture = readFileSync(
      join(root, 'tests/fixtures/transcript-composition.tsx'),
      'utf8'
    )
    writeFileSync(
      join(pilot, 'index.html'),
      '<div id="app"></div><script type="module" src="/main.tsx"></script>'
    )
    writeFileSync(
      join(pilot, 'main.tsx'),
      sourceFixture.replace(
        '../../src/components/conversation/transcript-composition',
        '@adea-ai/ui/components/conversation/transcript-composition'
      )
    )
    writeFileSync(
      join(pilot, 'style.css'),
      [
        "@import 'tailwindcss';",
        "@import '@adea-ai/ui/theme.css';",
        "@import '@adea-ai/ui/base.css';",
        "@source '../node_modules/@adea-ai/ui/src/components/conversation/transcript-composition';",
        "@source '../node_modules/@adea-ai/ui/src/components/ui/button';",
        "@source '../node_modules/@adea-ai/ui/src/lib/variants.ts';",
      ].join('\n')
    )
    const result = await build({
      root: pilot,
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
      resolve: { conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] },
      build: { write: false, minify: 'esbuild', target: 'esnext', modulePreload: false },
    })
    const outputs = Array.isArray(result) ? result : [result]
    const chunks = outputs.flatMap((output) => ('output' in output ? output.output : []))
    const js = chunks.filter((chunk) => chunk.type === 'chunk')
    if (js.length !== 1) throw new Error(`Packed ${condition} transcript emitted extra JS chunks`)
    const code = js.map((chunk) => chunk.code).join('\n')
    const modules = js.flatMap((chunk) =>
      Object.entries(chunk.modules)
        .filter(([, value]) => value.renderedLength > 0)
        .map(([id]) => id)
    )
    const uiModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = condition === 'compiled' ? '/dist/' : '/src/'
    if (!uiModules.some((id) => id.includes(expected)))
      throw new Error(`Wrong ${condition} transcript export selection`)
    if (uiModules.some((id) => id.includes(condition === 'compiled' ? '/src/' : '/dist/')))
      throw new Error('Packed transcript mixed compiled and Solid source conditions')
    const forbidden = modules.filter((id) =>
      /chart\.js|solid-chartjs|embla|xterm|codemirror|shiki|storybook|@adea-ai\/themes|\/components\/(?:theme|layout)|\/lib\/themes/.test(
        id
      )
    )
    if (forbidden.length) throw new Error(`Unrelated retained modules: ${forbidden.join(', ')}`)
    const solidRoots = new Set(
      modules
        .filter((id) => id.includes('/node_modules/solid-js/'))
        .map((id) =>
          id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
        )
    )
    if (solidRoots.size !== 1) throw new Error(`Expected one Solid runtime, got ${solidRoots.size}`)
    const css = chunks
      .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
      .map((chunk) => (chunk.type === 'asset' ? String(chunk.source) : ''))
      .join('\n')
    const gzipBytes = gzipSync(code).length
    const cssBytes = Buffer.byteLength(css)
    if (gzipBytes > MAX_GZIP_BYTES)
      throw new Error(`Packed transcript exceeds ${MAX_GZIP_BYTES} gzip JS bytes`)
    if (cssBytes > MAX_CSS_BYTES)
      throw new Error(`Packed transcript exceeds ${MAX_CSS_BYTES} raw CSS bytes`)
    console.log(
      JSON.stringify({
        pilot: 'transcript',
        condition,
        gzipBytes,
        cssBytes,
        retainedModules: modules,
      })
    )

    for (const [engine, browserType] of [
      ['chromium', chromium],
      ['webkit', webkit],
    ] as const) {
      const browser = await browserType.launch({ headless: true })
      let context: BrowserContext | undefined
      try {
        context = await browser.newContext({ viewport: { width: 900, height: 800 } })
        const page = await context.newPage()
        const pageErrors: string[] = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await page.setContent(
          '<!doctype html><html lang="en"><head><title>Transcript composition test</title></head>' +
            '<body><main><h1>Transcript composition test</h1><div id="app"></div></main></body></html>'
        )
        await page.addStyleTag({ content: css })
        await page.addScriptTag({ type: 'module', content: code })

        const trigger = page.getByRole('button', { name: /1 tool call/ })
        await expect(trigger).toBeVisible()
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect(trigger).toHaveAttribute('aria-disabled', 'true')
        await expect(page.locator('[data-render-label="Tool request"]')).toBeVisible()
        await expect(page.locator('[data-render-label="Tool result"]')).toBeVisible()
        await expect(page.locator('[data-render-label="Question"]')).toBeVisible()
        const controlHandle = await trigger.elementHandle()
        const requestHandle = await page
          .locator('[data-render-label="Tool request"]')
          .elementHandle()
        const controls = (await trigger.getAttribute('aria-controls'))?.split(/\s+/) ?? []
        if (!controls.length) throw new Error('Disclosure button has no controlled rows')
        for (const id of controls) {
          if (!(await page.locator(`[id="${id}"]`).count()))
            throw new Error(`Disclosure target ${id} is absent`)
        }
        const toolTarget = page.locator(`[id="${controls[0]}"]`)
        await expect(toolTarget.locator('xpath=..')).toHaveAttribute('data-display-kind', 'single')

        await page.getByRole('button', { name: 'Promote turn' }).click()
        await expect(toolTarget.locator('xpath=..')).toHaveAttribute('data-display-kind', 'turn')
        const controlAfterPromotion = await page
          .getByRole('button', { name: /1 tool call/ })
          .elementHandle()
        if (
          !controlHandle ||
          !controlAfterPromotion ||
          !(await controlAfterPromotion.evaluate(
            (current, original) => current === original,
            controlHandle
          ))
        )
          throw new Error(`${engine}/${condition}: promotion replaced the keyed disclosure owner`)
        if (
          !requestHandle ||
          !(await page
            .locator('[data-render-label="Tool request"]')
            .evaluate((current, original) => current === original, requestHandle))
        )
          throw new Error(`${engine}/${condition}: promotion replaced a keyed row body`)

        await page.getByRole('button', { name: 'Toggle running' }).click()
        // Disclosure labels change from “Show” to “Hide” as aria-expanded changes,
        // so keep a locator on the stable call-count portion of the accessible name.
        const settledTrigger = page.getByRole('button', { name: /1 tool call/ })
        await expect(settledTrigger).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('[data-render-label="Tool request"]')).toHaveCount(0)
        await expect(page.locator('[data-render-label="Tool result"]')).toHaveCount(0)
        await settledTrigger.press('Enter')
        await expect(settledTrigger).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator('[data-render-label="Tool request"]')).toBeVisible()
        await expect(page.locator('[data-render-label="Tool result"]')).toBeVisible()
        await page.getByRole('button', { name: 'Toggle running' }).click()
        await expect(settledTrigger).toHaveAttribute('aria-disabled', 'true')
        await page.getByRole('button', { name: 'Toggle running' }).click()
        await expect(settledTrigger).toHaveAttribute('aria-expanded', 'true')
        await settledTrigger.press('Space')
        await expect(settledTrigger).toHaveAttribute('aria-expanded', 'false')
        await page.getByRole('button', { name: 'Toggle running' }).click()
        await page.getByRole('button', { name: 'Toggle running' }).click()
        await expect(settledTrigger).toHaveAttribute('aria-expanded', 'false')

        for (const label of ['Pending approval', 'Review required', 'Final answer'])
          await expect(page.locator(`[data-render-label="${label}"]`)).toBeVisible()
        const reasoning = page.locator('[data-render-label="Interim reasoning"]')
        const reasoningHandle = await reasoning.elementHandle()
        await page.getByRole('button', { name: 'Collapse all activity', exact: true }).click()
        await expect(
          page.getByRole('button', { name: 'Expand all activity', exact: true })
        ).toBeVisible()
        await expect(reasoning).toBeHidden()
        if (
          !(await reasoning.evaluate((element, original) => element === original, reasoningHandle))
        )
          throw new Error(`${engine}/${condition}: collapse-all replaced mounted interim prose`)
        for (const label of ['Pending approval', 'Review required', 'Final answer'])
          await expect(page.locator(`[data-render-label="${label}"]`)).toBeVisible()
        await expect(page.locator('[data-render-label="Tool request"]')).toBeHidden()
        await expect(page.locator('[data-render-label="Tool request"]')).toHaveCount(1)
        await page.getByRole('button', { name: 'Expand all activity', exact: true }).click()
        await expect(reasoning).toBeVisible()
        await expect(page.locator('[data-render-label="Tool request"]')).toBeVisible()
        if (
          !(await reasoning.evaluate((element, original) => element === original, reasoningHandle))
        )
          throw new Error(`${engine}/${condition}: expanding replaced mounted interim prose`)

        await page.getByRole('button', { name: 'Reset to tool-only transcript' }).click()
        const toolOnly = page.getByRole('button', { name: 'Show 1 tool call', exact: true })
        await expect(toolOnly).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('[data-render-label="Tool request"]')).toHaveCount(0)
        await page.getByRole('button', { name: 'Collapse all activity', exact: true }).click()
        await expect(toolOnly).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('[data-render-label="Tool request"]')).toHaveCount(1)
        await expect(page.locator('[data-render-label="Tool request"]')).toBeHidden()
        await page.getByRole('button', { name: 'Expand all activity', exact: true }).click()
        await expect(page.locator('[data-render-label="Tool request"]')).toBeVisible()

        await page.getByRole('button', { name: 'Load mixed interim and synthesis scope' }).click()
        await expect(page.locator('[data-slot="transcript-composition"]')).toHaveAttribute(
          'data-fold-state',
          'collapsed'
        )
        await expect(page.locator('[data-render-label="Interim tool request"]')).toBeHidden()
        await expect(page.locator('[data-render-label="Interim work row"]')).toBeHidden()
        await expect(page.locator('[data-render-label="Synthesis result"]')).toBeHidden()
        await expect(page.locator('[data-render-label="Mixed final answer"]')).toBeVisible()

        const violations = await new AxeBuilder({ page }).analyze()
        if (violations.violations.length)
          throw new Error(
            `Axe violations: ${violations.violations.map((item) => item.id).join(', ')}`
          )
        if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(', ')}`)
        console.log(
          JSON.stringify({
            pilot: 'transcript',
            condition,
            engine,
            checks: [
              'settled-tool-unmount',
              'aria-control-targets',
              'loose-to-turn-identity',
              'keyboard-disclosure',
              'running-pin',
              'always-visible-actions',
              'collapse-all-retains-prose',
              'mixed-interim-conclusion-visible',
              'axe',
            ],
          })
        )
      } finally {
        try {
          if (context) await context.close()
        } finally {
          await browser.close()
        }
      }
    }
  }
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
