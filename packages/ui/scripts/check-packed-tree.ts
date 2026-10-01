/** Actual npm-tarball, typed-consumer, windowed keyboard, bounds and Axe contract for Tree. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import AxeBuilder from '@axe-core/playwright'
import { chromium, expect, webkit, type BrowserContext } from '@playwright/test'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'

const uiRoot = resolve(import.meta.dir, '..')
const repositoryRoot = resolve(uiRoot, '../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-packed-tree-'))
const maxGzipBytes = 40 * 1024
const maxCssBytes = 42 * 1024
console.log(JSON.stringify({ owner: 'packed-tree-check', runnerPid: process.pid, consumer }))

try {
  const [archive] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: uiRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
  ) as [{ filename: string }]
  const packageManifest = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
  }
  const solidVersion = JSON.parse(
    readFileSync(join(uiRoot, 'node_modules/solid-js/package.json'), 'utf8')
  ) as { version: string }
  const tailwindVersion = JSON.parse(
    readFileSync(join(repositoryRoot, 'node_modules/tailwindcss/package.json'), 'utf8')
  ) as { version: string }

  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'adea-packed-tree-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${join(consumer, archive.filename)}`,
        'lucide-solid': packageManifest.dependencies['lucide-solid'],
        'solid-js': packageManifest.peerDependencies['solid-js'] ?? solidVersion.version,
        tailwindcss: tailwindVersion.version,
      },
    })
  )
  execFileSync('bun', ['install', '--ignore-scripts', '--omit=optional'], {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 120_000,
  })

  const packageRoot = join(consumer, 'node_modules/@adea-ai/ui')
  const notice = readFileSync(join(packageRoot, 'dist/NOTICE'), 'utf8')
  if (
    !notice.includes('TreeRow.tsx') ||
    !notice.includes('b02a7dcbfe58d22b2352d9618b8ed3199e317a00')
  )
    throw new Error('Packed NOTICE lost the Terax TreeRow attribution')
  if (!readFileSync(join(packageRoot, 'dist/LICENSE'), 'utf8').includes('Apache License'))
    throw new Error('Packed LICENSE is missing')
  for (const path of [
    'dist/components/composites/tree/index.js',
    'dist/components/composites/tree/index.d.ts',
    'dist/components/composites/tree/tree.js',
    'dist/components/composites/tree/tree.d.ts',
    'dist/components/layout/virtual-window/index.js',
    'dist/components/layout/virtual-window/index.d.ts',
    'src/components/composites/tree/index.ts',
    'src/components/composites/tree/tree.tsx',
  ]) {
    if (!existsSync(join(packageRoot, path))) throw new Error(`Packed tree file missing: ${path}`)
  }

  writeFileSync(
    join(consumer, 'type-probe.tsx'),
    `import { Tree as RootTree } from '@adea-ai/ui'
import { Tree, TreeRow, type TreeItemDescriptor } from '@adea-ai/ui/components/composites/tree'
import { VirtualWindow } from '@adea-ai/ui/components/layout/virtual-window'

const item: TreeItemDescriptor = {
  id: 'root', parentId: null, level: 1, expandable: false, expanded: false,
}
const rows: readonly TreeItemDescriptor[] = [item]
const onActiveIdChange = (id: string) => id
const onRowSizeChange = (id: string, blockSize: number) => id + ':' + blockSize

export function PackedTreeConsumer() {
  return (
    <Tree aria-label="Packed tree" visibleItems={rows} activeId="root" onActiveIdChange={onActiveIdChange} onRowSizeChange={onRowSizeChange}>
      <TreeRow item={item}>Workspace</TreeRow>
    </Tree>
  )
}

export function RootExportConsumer() {
  return <VirtualWindow totalSize={0}><RootTree aria-label="Root export" visibleItems={rows} activeId="root" onActiveIdChange={onActiveIdChange} /></VirtualWindow>
}
`
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
      },
      include: ['type-probe.tsx'],
    })
  )
  execFileSync(
    resolve(repositoryRoot, 'node_modules/.bin/tsc'),
    ['-p', join(consumer, 'tsconfig.json')],
    {
      cwd: consumer,
      stdio: 'inherit',
      timeout: 120_000,
    }
  )

  const fixture = readFileSync(join(uiRoot, 'tests/fixtures/tree.tsx'), 'utf8')
    .replace('../../src/components/ui/button/button', '@adea-ai/ui/components/ui/button')
    .replace('../../src/components/composites/tree', '@adea-ai/ui/components/composites/tree')
    .replace(
      '../../src/components/layout/virtual-window',
      '@adea-ai/ui/components/layout/virtual-window'
    )
    .replace('../../src/styles/globals.css', './style.css')

  for (const condition of ['compiled', 'solid'] as const) {
    const pilot = join(consumer, condition)
    const main = join(pilot, 'main.tsx')
    mkdirSync(pilot)
    writeFileSync(
      join(pilot, 'index.html'),
      '<div id="app"></div><script type="module" src="/main.tsx"></script>'
    )
    writeFileSync(main, fixture)
    writeFileSync(
      join(pilot, 'style.css'),
      [
        "@import 'tailwindcss';",
        "@import '@adea-ai/ui/theme.css';",
        "@import '@adea-ai/ui/base.css';",
        "@source './main.tsx';",
        "@source '../node_modules/@adea-ai/ui/src/components/composites/tree';",
        "@source '../node_modules/@adea-ai/ui/src/components/layout/virtual-window';",
        "@source '../node_modules/@adea-ai/ui/src/components/ui/button';",
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
                name: 'packed-tree-compiled-condition',
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
    const javascript = chunks.filter((chunk) => chunk.type === 'chunk')
    if (javascript.length !== 1) throw new Error(`Packed ${condition} tree emitted extra JS chunks`)
    const code = javascript.map((chunk) => chunk.code).join('\n')
    const modules = javascript.flatMap((chunk) =>
      Object.entries(chunk.modules)
        .filter(([, module]) => module.renderedLength > 0)
        .map(([id]) => id)
    )
    const uiModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expectedCondition = condition === 'compiled' ? '/dist/' : '/src/'
    if (!uiModules.some((id) => id.includes(expectedCondition)))
      throw new Error(`Packed ${condition} tree selected the wrong package condition`)
    if (uiModules.some((id) => id.includes(condition === 'compiled' ? '/src/' : '/dist/')))
      throw new Error(`Packed ${condition} tree mixed compiled and Solid source conditions`)
    const forbiddenModules = modules.filter((id) => /react|tauri|hugeicons|terax-ai/.test(id))
    if (forbiddenModules.length)
      throw new Error(`Packed tree retained donor/runtime modules: ${forbiddenModules.join(', ')}`)
    const css = chunks
      .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
      .map((chunk) => (chunk.type === 'asset' ? String(chunk.source) : ''))
      .join('\n')
    const gzipBytes = gzipSync(code).length
    const cssBytes = Buffer.byteLength(css)
    if (gzipBytes > maxGzipBytes)
      throw new Error(`Packed tree exceeds ${maxGzipBytes} gzip JS bytes (${gzipBytes})`)
    if (cssBytes > maxCssBytes)
      throw new Error(`Packed tree exceeds ${maxCssBytes} raw CSS bytes (${cssBytes})`)

    console.log(JSON.stringify({ pilot: 'packed-tree', condition, gzipBytes, cssBytes, modules }))

    for (const [engine, browserType] of [
      ['chromium', chromium],
      ['webkit', webkit],
    ] as const) {
      const browser = await browserType.launch({ headless: true })
      let context: BrowserContext | undefined
      try {
        context = await browser.newContext({ viewport: { width: 640, height: 720 } })
        const page = await context.newPage()
        const pageErrors: string[] = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await page.setContent(
          '<!doctype html><html lang="en"><head><title>Windowed tree contract</title></head>' +
            '<body><div id="app"></div></body></html>'
        )
        await page.addStyleTag({ content: css })
        await page.addScriptTag({ type: 'module', content: code })

        const tree = page.getByRole('tree', { name: 'Workspace files' })
        const root = page.getByRole('treeitem', { name: 'workspace' })
        await expect(tree).toBeVisible()
        await expect(root).toHaveAttribute('aria-level', '1')
        await expect(root).toHaveAttribute('aria-expanded', 'true')
        await expect(page.getByRole('treeitem')).toHaveCount(6)
        await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)
        await expect(page.getByLabel('Full projection count')).toHaveText('100001')

        const beforeTreeButton = page.getByRole('button', { name: 'Before tree' })
        const viewportRegion = page.getByRole('region', { name: 'Workspace tree viewport' })
        await beforeTreeButton.focus()
        await beforeTreeButton.press('Tab')
        await expect(viewportRegion).toBeFocused()
        await viewportRegion.press('Tab')
        await expect(root).toBeFocused()

        const firstFile = page.getByRole('treeitem', { name: 'file 0' })
        await root.press('ArrowRight')
        await expect(firstFile).toBeFocused()
        await expect(firstFile).toHaveAttribute('aria-posinset', '1')
        await expect(firstFile).toHaveAttribute('aria-setsize', '100000')
        await expect(root).toHaveAttribute('data-consumer-ref', 'attached')
        await firstFile.press('ArrowUp')
        await expect(root).toBeFocused()
        await root.press('ArrowUp')
        const lastFile = page.getByRole('treeitem', { name: 'file 99999' })
        await expect(lastFile).toBeFocused()
        await expect(lastFile).toHaveAttribute('aria-posinset', '100000')
        await expect(lastFile).toHaveAttribute('aria-setsize', '100000')
        await expect(page.getByRole('treeitem')).toHaveCount(6)
        await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)
        await lastFile.press('ArrowDown')
        await expect(root).toBeFocused()
        await root.press('End')
        await expect(lastFile).toBeFocused()
        await expect(lastFile).toHaveAttribute('aria-posinset', '100000')
        await expect(page.getByRole('treeitem')).toHaveCount(6)
        await lastFile.press('ArrowDown')
        await expect(root).toBeFocused()

        await root.press('ArrowLeft')
        await expect(root).toHaveAttribute('aria-expanded', 'false')
        await expect(page.getByRole('treeitem')).toHaveCount(1)
        await root.press('ArrowRight')
        await expect(root).toHaveAttribute('aria-expanded', 'true')
        await root.press('ArrowRight')
        await expect(firstFile).toBeFocused()
        await firstFile.press('Enter')
        await expect(page.getByLabel('Activation count')).toHaveText('1')
        await firstFile.press('Space')
        await expect(page.getByLabel('Selected row')).toHaveText('file-0')

        const rename = page.getByRole('button', { name: 'Rename file-0' })
        await expect(firstFile).toBeFocused()
        await firstFile.press('Tab')
        await expect(rename).toBeFocused()
        await rename.press('ArrowDown')
        await expect(page.getByLabel('Active row')).toHaveText('file-0')
        await rename.press('Enter')
        await expect(page.getByLabel('Action count')).toHaveText('1')
        const copy = page.getByRole('button', { name: 'Copy file-0' })
        await rename.press('Tab')
        await expect(copy).toBeFocused()
        await copy.press('ArrowDown')
        await expect(page.getByLabel('Active row')).toHaveText('file-0')
        await copy.press('Enter')
        await expect(page.getByLabel('Action count')).toHaveText('2')

        await page.setViewportSize({ width: 320, height: 640 })
        const bounds = await tree.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const row = element.querySelector('[role="treeitem"]')?.getBoundingClientRect()
          return {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            left: row?.left ?? Number.NaN,
            right: row?.right ?? Number.NaN,
            width: rect.width,
          }
        })
        if (
          bounds.scrollWidth > bounds.clientWidth ||
          bounds.left < 0 ||
          bounds.right > 320 ||
          bounds.width > 320
        )
          throw new Error(`${engine}/${condition}: tree overflowed the 320px CSS viewport bounds`)

        const violations = await new AxeBuilder({ page }).analyze()
        if (violations.violations.length)
          throw new Error(
            `Axe violations: ${violations.violations.map((violation) => violation.id).join(', ')}`
          )
        if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(', ')}`)

        console.log(
          JSON.stringify({
            pilot: 'packed-tree',
            condition,
            engine,
            mountedTreeItems: 6,
            fullProjectionItems: 100001,
            checks: [
              'up-down-wrap',
              'right-expand-and-first-child',
              'left-collapse-and-parent',
              'single-roving-tab-stop',
              'focus-reveals-unmounted-row',
              '100k-logical-projection-with-bounded-mounted-window',
              'mounted-window-stays-bounded',
              'sibling-position-from-full-projection',
              'row-action-keyboard-reachable',
              '320px-css-viewport-overflow-bounds',
              'axe',
            ],
            narrowViewport: bounds,
          })
        )

        await page.close()
        const fallbackPage = await context.newPage()
        const fallbackErrors: string[] = []
        fallbackPage.on('pageerror', (error) => fallbackErrors.push(error.message))
        await fallbackPage.setViewportSize({ width: 640, height: 720 })
        await fallbackPage.setContent(
          '<!doctype html><html lang="en"><head><title>Tree focus fallback</title></head>' +
            '<body><div id="app"></div></body></html>'
        )
        await fallbackPage.evaluate(() => {
          document.documentElement.dataset.treeFixtureActive = 'null'
          document.documentElement.dataset.treeFixtureWindow = '6'
        })
        await fallbackPage.addStyleTag({ content: css })
        await fallbackPage.addScriptTag({ type: 'module', content: code })
        const fallbackTree = fallbackPage.getByRole('tree', { name: 'Workspace files' })
        const fallbackRoot = fallbackPage.getByRole('treeitem', { name: 'workspace' })
        await expect(fallbackRoot).toBeVisible()
        await expect(fallbackPage.getByLabel('Active row')).toHaveText('root')
        await expect(fallbackTree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)

        await fallbackPage.getByRole('button', { name: 'Set stale active id' }).click()
        await expect(fallbackPage.getByLabel('Active row')).toHaveText('root')
        await expect(fallbackTree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)

        const fallbackBeforeTree = fallbackPage.getByRole('button', { name: 'Before tree' })
        const treeViewport = fallbackPage.getByRole('region', {
          name: 'Workspace tree viewport',
        })
        await fallbackPage.getByRole('button', { name: 'Clear active id' }).click()
        await fallbackBeforeTree.focus()
        await fallbackBeforeTree.press('Tab')
        await expect(treeViewport).toBeFocused()
        await treeViewport.press('Tab')
        await expect(fallbackRoot).toBeFocused()

        await fallbackPage.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
        await expect(fallbackPage.getByLabel('Measured row height')).toHaveText('56')
        await expect(fallbackPage.getByLabel('Viewport height')).toHaveText('256')
        await expect(fallbackPage.getByLabel('Observed row count')).toHaveText('6')
        await expect(fallbackPage.getByLabel('Virtual scroll height')).toHaveText('5600056')
        const fontMetrics = await fallbackTree.evaluate((element) => {
          const row = element.querySelector('[role="treeitem"]')
          const label = row?.querySelector(':scope > span.min-w-0.flex-1.truncate')
          if (!row || !label) return null
          return {
            rowHeight: row.getBoundingClientRect().height,
            labelHeight: label.getBoundingClientRect().height,
            fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
            scrollHeight: label.scrollHeight,
            clientHeight: label.clientHeight,
          }
        })
        if (
          !fontMetrics ||
          fontMetrics.rowHeight < fontMetrics.fontSize ||
          fontMetrics.labelHeight < fontMetrics.fontSize ||
          fontMetrics.scrollHeight > fontMetrics.clientHeight
        )
          throw new Error(
            `${engine}/${condition}: tree row text does not fit at 200% root font size`
          )

        await fallbackRoot.press('End')
        const lastRow = fallbackPage.getByRole('treeitem', { name: 'file 99999' })
        await expect(lastRow).toBeFocused()
        await expect(lastRow).toHaveAttribute('aria-posinset', '100000')
        await expect(lastRow).toHaveAttribute('aria-setsize', '100000')
        await lastRow.press('Space')
        await expect(fallbackPage.getByLabel('Selected row')).toHaveText('file-99999')
        const endGeometry = await fallbackPage.evaluate(() => {
          const viewport = document.querySelector<HTMLElement>('[data-testid="tree-test-viewport"]')
          const rows = [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')]
          const last = rows.find((row) => row.dataset.treeId === 'file-99999')
          if (!viewport || !last) return null
          const viewportBounds = viewport.getBoundingClientRect()
          const lastBounds = last.getBoundingClientRect()
          let previousBottom: number | undefined
          let overlap = 0
          for (const row of rows) {
            const rect = row.getBoundingClientRect()
            if (previousBottom !== undefined) overlap = Math.max(overlap, previousBottom - rect.top)
            previousBottom = rect.bottom
          }
          return {
            scrollTop: viewport.scrollTop,
            maxScrollTop: viewport.scrollHeight - viewport.clientHeight,
            lastTop: lastBounds.top,
            lastBottom: lastBounds.bottom,
            viewportTop: viewportBounds.top,
            viewportBottom: viewportBounds.bottom,
            rowHeight: lastBounds.height,
            overlap,
            mountedRows: rows.length,
          }
        })
        if (
          !endGeometry ||
          Math.abs(endGeometry.scrollTop - endGeometry.maxScrollTop) > 1 ||
          endGeometry.lastTop < endGeometry.viewportTop - 1 ||
          endGeometry.lastBottom > endGeometry.viewportBottom + 1 ||
          endGeometry.rowHeight !== 56 ||
          endGeometry.overlap > 0.5 ||
          endGeometry.mountedRows !== 6
        )
          throw new Error(
            `${engine}/${condition}: enlarged end row did not fit the measured virtual window`
          )
        await lastRow.press('ArrowDown')
        await expect(fallbackRoot).toBeFocused()
        await expect(fallbackPage.getByLabel('Scroll top')).toHaveText('0')
        await expect(fallbackPage.getByRole('treeitem')).toHaveCount(6)

        await fallbackPage.getByRole('button', { name: 'Set last active id' }).click()
        const lastFilteredRow = fallbackPage.getByRole('treeitem', { name: 'file 99999' })
        await expect(lastFilteredRow).toBeVisible()
        await lastFilteredRow.focus()
        await fallbackPage.evaluate(() => {
          window.dispatchEvent(new Event('tree-fixture:hide-last'))
        })
        await expect(fallbackRoot).toBeFocused()
        await expect(fallbackPage.getByLabel('Active row')).toHaveText('root')
        await expect(fallbackTree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)
        await expect(fallbackPage.getByRole('treeitem')).toHaveCount(6)
        if (fallbackErrors.length)
          throw new Error(`Fallback browser errors: ${fallbackErrors.join(', ')}`)
        console.log(
          JSON.stringify({
            pilot: 'packed-tree-focus-fallback',
            condition,
            engine,
            checks: [
              'tab-enters-after-null-and-stale-active-fallback',
              'focus-reveals-row-outside-initial-window',
              '200-percent-root-font-row-size-reported-to-host',
              'scroll-to-offscreen-100k-end-row-with-no-overlap',
              'end-to-first-wrap-preserves-scroll-boundaries',
              'focused-row-removal-reveals-and-focuses-fallback',
              'one-roving-tab-stop',
            ],
            rootFontStress: fontMetrics,
            virtualEndGeometry: endGeometry,
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
