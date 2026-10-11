/** Proves a packed SplitLayout downloads Corvu only after a real split is mounted. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, webkit, type BrowserType } from '@playwright/test'
import { build, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'

type Condition = 'compiled' | 'solid'
type PackedChunk = {
  fileName: string
  isEntry: boolean
  imports: string[]
  dynamicImports: string[]
  modules: string[]
  code: string
}

const fixture = `
import { createSignal, ErrorBoundary, onCleanup, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { SplitLayout } from '@adea-ai/ui/components/layout/split-layout'
import { closePane, createLayoutState, resizeSplit, splitPane } from '@adea-ai/ui/components/layout/split-layout/model'

function App() {
  const [state, setState] = createSignal(createLayoutState({ kind: 'leaf', id: 'a' }))
  const [mounted, setMounted] = createSignal(true)
  const act = (event: Event) => {
    const action = (event as CustomEvent<string>).detail
    if (action === 'split') setState((current) => splitPane(current, 'a', {
      direction: 'row', placement: 'after', leaf: { kind: 'leaf', id: 'b' }, splitId: 'ab',
    }))
    if (action === 'split-column') setState((current) => splitPane(current, 'a', {
      direction: 'column', placement: 'after', leaf: { kind: 'leaf', id: 'b' }, splitId: 'ab',
    }))
    if (action === 'close') setState((current) => closePane(current, 'b', () => ({ kind: 'leaf', id: 'placeholder' })))
    if (action === 'unmount') setMounted(false)
    if (action === 'mount') {
      setState(createLayoutState({ kind: 'leaf', id: 'a' }))
      setMounted(true)
    }
  }
  window.addEventListener('packed-layout-lazy', act)
  onCleanup(() => window.removeEventListener('packed-layout-lazy', act))
  return <>
    <main id="layout-host">
      <ErrorBoundary fallback={() => <p role="alert">Resize controller failed</p>}>
        <Show when={mounted()}>
          <SplitLayout
            state={state()}
            label="Work panes"
            labelForLeaf={(leaf) => \`Pane \${leaf.id}\`}
            renderLeaf={(leaf) => <textarea aria-label={\`Editor \${leaf().id}\`} data-editor={leaf().id} />}
            onResize={(id, ratio) => setState((current) => resizeSplit(current, id, ratio))}
          />
        </Show>
      </ErrorBoundary>
    </main>
    <button id="outside-focus-target" type="button">Outside focus target</button>
  </>
}

render(() => <App />, document.getElementById('root')!)
`

const styles = `
html, body, #root { margin: 0; width: 100%; height: 100%; }
#layout-host, [data-slot="split-layout"] { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
#outside-focus-target { position: fixed; left: 8px; bottom: 8px; }
.absolute { position: absolute; }
[data-pane-id] { position: absolute; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
[data-pane-id] > div { flex: 1; min-width: 0; min-height: 0; overflow: auto; }
[data-slot="split-layout"] > [role="separator"][aria-disabled="true"][tabindex="-1"] { position: absolute; }
[data-slot="split-layout"] > [role="separator"][aria-disabled="true"][tabindex="-1"][data-direction="row"] { width: 1px; height: var(--split-layout-separator-length); transform: translateX(-50%); }
[data-slot="split-layout"] > [role="separator"][aria-disabled="true"][tabindex="-1"][data-direction="column"] { width: var(--split-layout-separator-length); height: 1px; transform: translateY(-50%); }
`

function packedChunksPlugin(records: PackedChunk[]): Plugin {
  return {
    name: 'packed-layout-lazy-chunk-evidence',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        records.push({
          fileName: output.fileName,
          isEntry: output.isEntry,
          imports: [...output.imports],
          dynamicImports: [...output.dynamicImports],
          modules: Object.keys(output.modules).map((id) => id.replaceAll('\\', '/')),
          code: output.code,
        })
      }
    },
  }
}

function staticClosure(entry: PackedChunk, byName: Map<string, PackedChunk>): Set<string> {
  const visited = new Set<string>()
  const pending = [entry.fileName]
  while (pending.length) {
    const name = pending.pop()!
    if (visited.has(name)) continue
    visited.add(name)
    for (const dependency of byName.get(name)?.imports ?? [])
      if (byName.has(dependency)) pending.push(dependency)
  }
  return visited
}

function contentType(path: string): string {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

function deferred<T>() {
  let fulfill!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((completePromise) => {
    fulfill = completePromise
  })
  return { promise, resolve: fulfill }
}

async function withStaticServer<T>(directory: string, action: (url: string) => Promise<T>) {
  const base = resolve(directory)
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      const candidate = resolve(base, `.${pathname === '/' ? '/index.html' : pathname}`)
      if (candidate !== base && !candidate.startsWith(`${base}${sep}`)) {
        response.writeHead(403).end()
        return
      }
      const body = await readFile(candidate)
      response.writeHead(200, { 'content-type': contentType(candidate) }).end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Packed ESM server has no TCP port')
  try {
    return await action(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolveClose, reject) =>
      server.close((error) => (error ? reject(error) : resolveClose()))
    )
  }
}

export async function verifyPackedLayoutLazyController(consumer: string, condition: Condition) {
  const work = await mkdtemp(join(consumer, `lazy-controller-${condition}-`))
  const output = join(work, 'dist')
  const entry = join(work, 'entry.tsx')
  await writeFile(entry, fixture)
  const records: PackedChunk[] = []
  const conditionPlugin: Plugin = {
    name: `packed-layout-${condition}-condition`,
    enforce: 'post',
    configEnvironment(_name, config) {
      config.resolve ??= {}
      config.resolve.conditions =
        condition === 'compiled' ? ['browser', 'import'] : ['solid', 'browser']
    },
  }
  try {
    await build({
      root: work,
      configFile: false,
      logLevel: 'error',
      plugins: [solid(), conditionPlugin, packedChunksPlugin(records)],
      resolve: {
        conditions: condition === 'compiled' ? ['browser', 'import'] : ['solid', 'browser'],
      },
      build: {
        target: 'esnext',
        minify: 'esbuild',
        outDir: output,
        emptyOutDir: true,
        rollupOptions: {
          input: entry,
        },
      },
    })
    const chunks = records
    const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
    const entryChunk = chunks.find((chunk) => chunk.isEntry)
    if (!entryChunk) throw new Error(`Packed ${condition} build emitted no ESM entry chunk`)
    const corvuChunks = chunks.filter((chunk) =>
      chunk.modules.some((id) => id.includes('/node_modules/@corvu/resizable/'))
    )
    if (!corvuChunks.length) throw new Error(`Packed ${condition} build omitted @corvu/resizable`)
    const controllerChunks = chunks.filter((chunk) =>
      chunk.modules.some((id) => id.includes('/split-layout/resize-controller'))
    )
    if (!controllerChunks.length)
      throw new Error(`Packed ${condition} build omitted its resize controller chunk`)
    const hasControllerModule = (chunk: PackedChunk, name: string) =>
      chunk.modules.some(
        (id) => id.endsWith(`/split-layout/${name}.tsx`) || id.endsWith(`/split-layout/${name}.js`)
      )
    const initialFacade = chunks.find((chunk) => hasControllerModule(chunk, 'resize-controller'))
    const retryFacade = chunks.find((chunk) =>
      hasControllerModule(chunk, 'resize-controller-retry')
    )
    const retryTwoFacade = chunks.find((chunk) =>
      hasControllerModule(chunk, 'resize-controller-retry-2')
    )
    const sharedController = chunks.find((chunk) =>
      hasControllerModule(chunk, 'resize-controller-core')
    )
    const retryController = chunks.find((chunk) =>
      hasControllerModule(chunk, 'resize-controller-core-retry')
    )
    if (!initialFacade || !retryFacade || !retryTwoFacade || !sharedController || !retryController)
      throw new Error(
        `Packed ${condition} build omitted a primary or independent retry controller chunk`
      )
    if (
      initialFacade.fileName === retryFacade.fileName ||
      initialFacade.fileName === retryTwoFacade.fileName ||
      retryFacade.fileName === retryTwoFacade.fileName ||
      !initialFacade.imports.includes(sharedController.fileName) ||
      !retryFacade.imports.includes(sharedController.fileName) ||
      staticClosure(retryTwoFacade, byName).has(sharedController.fileName) ||
      !retryController.modules.some(
        (id) =>
          id.endsWith('/split-layout/resize-controller-core-retry.tsx') ||
          id.endsWith('/split-layout/resize-controller-core-retry.js')
      ) ||
      retryController.fileName === sharedController.fileName
    )
      throw new Error(
        `Packed ${condition} controller facades did not share one separately-loaded implementation`
      )
    const eagerNames = staticClosure(entryChunk, byName)
    const eager = chunks.filter((chunk) => eagerNames.has(chunk.fileName))
    const measurement = {
      condition,
      entry: entryChunk.fileName,
      entryStaticFiles: [...eagerNames],
      corvuFiles: corvuChunks.map((chunk) => chunk.fileName),
      controllerFiles: controllerChunks.map((chunk) => chunk.fileName),
      controllerChunkSizes: controllerChunks.map((chunk) => ({
        fileName: chunk.fileName,
        rawBytes: Buffer.byteLength(chunk.code),
        gzipBytes: gzipSync(chunk.code).length,
      })),
      controllerRawBytes: controllerChunks.reduce(
        (total, chunk) => total + Buffer.byteLength(chunk.code),
        0
      ),
      controllerGzipBytes: gzipSync(controllerChunks.map((chunk) => chunk.code).join('\n')).length,
      corvuIsDeferred: corvuChunks.every((chunk) => !eagerNames.has(chunk.fileName)),
      eagerRawBytes: eager.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0),
      eagerGzipBytes: gzipSync(eager.map((chunk) => chunk.code).join('\n')).length,
      totalRawBytes: chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0),
      totalGzipBytes: gzipSync(chunks.map((chunk) => chunk.code).join('\n')).length,
      corvuRawBytes: corvuChunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0),
      corvuGzipBytes: gzipSync(corvuChunks.map((chunk) => chunk.code).join('\n')).length,
    }
    console.log(JSON.stringify({ packedLayoutLazyMeasurement: measurement }))

    await writeFile(
      join(output, 'index.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Packed lazy layout</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/${entryChunk.fileName}"></script></body></html>`
    )
    await writeFile(join(output, 'fixture.css'), styles)
    const corvuFiles = new Set(corvuChunks.map((chunk) => chunk.fileName))
    const controllerFiles = new Set(controllerChunks.map((chunk) => chunk.fileName))
    const controllerFacadeFiles = new Set([
      initialFacade.fileName,
      retryFacade.fileName,
      retryTwoFacade.fileName,
    ])
    const isControllerRequest = (url: string) => {
      const pathname = new URL(url).pathname.slice(1)
      return [...controllerFiles].some((file) => pathname.endsWith(file))
    }
    const isControllerFacadeRequest = (url: string) => {
      const pathname = new URL(url).pathname.slice(1)
      return [...controllerFacadeFiles].some((file) => pathname.endsWith(file))
    }
    const browserTypes: BrowserType[] =
      process.env['ADEA_PACKED_LAYOUT_BROWSER'] === 'chromium' ? [chromium] : [chromium, webkit]
    const chromiumExecutablePath = process.env['ADEA_CHROMIUM_EXECUTABLE_PATH']
    for (const browserType of browserTypes) {
      const browser = await browserType.launch({
        headless: true,
        ...(browserType === chromium && chromiumExecutablePath
          ? { executablePath: chromiumExecutablePath }
          : {}),
      })
      try {
        await withStaticServer(output, async (url) => {
          const page = await browser.newPage()
          const pageErrors: string[] = []
          const corvuRequests = new Set<string>()
          page.on('pageerror', (error) => pageErrors.push(error.message))
          page.on('request', (request) => {
            const pathname = new URL(request.url()).pathname.slice(1)
            if (corvuFiles.has(pathname)) corvuRequests.add(pathname)
          })
          await page.goto(url)
          const editor = page.getByRole('textbox', { name: 'Editor a', exact: true })
          await editor.waitFor()
          assert.equal(
            corvuRequests.size,
            0,
            `Packed ${condition}/${browserType.name()} requested Corvu before any split was present`
          )
          assert.equal(
            measurement.corvuIsDeferred,
            true,
            `Packed ${condition} static ESM graph contains Corvu before split`
          )

          await editor.fill('preserved draft')
          await editor.evaluate((element) => {
            element.focus()
            ;(element as HTMLTextAreaElement).setSelectionRange(4, 10, 'backward')
            ;(window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity = element
          })
          await page.evaluate(() =>
            window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
          )
          const separator = page.getByRole('separator', { name: 'Resize pane columns' })
          await separator.waitFor()
          await page.waitForFunction(
            (files) =>
              performance
                .getEntriesByType('resource')
                .some((resource) =>
                  files.some((file) => new URL(resource.name).pathname.endsWith(`/${file}`))
                ),
            [...corvuFiles]
          )
          await page.locator('[data-corvu-resizable-handle]').waitFor()
          assert.ok(corvuRequests.size > 0, `Packed ${condition} did not request its Corvu chunk`)
          assert.equal(await editor.inputValue(), 'preserved draft')
          assert.equal(await editor.evaluate((element) => element.isConnected), true)
          assert.equal(
            await editor.evaluate(
              (element) =>
                (window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity ===
                element
            ),
            true,
            `Packed ${condition}/${browserType.name()} replaced the existing leaf DOM while mounting Corvu`
          )
          assert.equal(await editor.evaluate((element) => document.activeElement === element), true)
          assert.deepEqual(
            await editor.evaluate((element) => {
              const field = element as HTMLTextAreaElement
              return [field.selectionStart, field.selectionEnd, field.selectionDirection]
            }),
            [4, 10, 'backward']
          )
          await separator.focus()
          await separator.press('ArrowRight')
          assert.equal(await separator.getAttribute('aria-valuenow'), '55')

          await page.evaluate(() =>
            window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'close' }))
          )
          await separator.waitFor({ state: 'detached' })
          assert.equal(await page.getByRole('separator').count(), 0)
          assert.equal(await editor.inputValue(), 'preserved draft')
          assert.equal(
            await page.getByRole('textbox', { name: 'Editor b', exact: true }).count(),
            0
          )
          assert.deepEqual(pageErrors, [])
          console.log(
            JSON.stringify({
              packedLayoutLazyBrowser: { condition, browser: browserType.name(), result: 'passed' },
            })
          )
          await page.close()

          if (browserType === chromium) {
            const collapsedPage = await browser.newPage()
            const collapsedErrors: string[] = []
            let collapsedRequests = 0
            const collapseStarted = deferred<void>()
            const failCollapsedRequest = deferred<void>()
            collapsedPage.on('pageerror', (error) => collapsedErrors.push(error.message))
            await collapsedPage.route(
              (routeUrl) => isControllerFacadeRequest(routeUrl.href),
              async (route) => {
                collapsedRequests += 1
                if (collapsedRequests === 1) {
                  collapseStarted.resolve()
                  await failCollapsedRequest.promise
                  await route.abort('failed')
                } else {
                  await route.continue()
                }
              }
            )
            await collapsedPage.goto(url)
            const collapsedEditor = collapsedPage.getByRole('textbox', {
              name: 'Editor a',
              exact: true,
            })
            await collapsedEditor.waitFor()
            await collapsedEditor.fill('collapse during failed load')
            await collapsedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await collapseStarted.promise
            await collapsedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'close' }))
            )
            assert.equal(await collapsedPage.getByRole('separator').count(), 0)
            failCollapsedRequest.resolve()
            await collapsedPage.waitForFunction(
              () => performance.getEntriesByType('resource').length > 0
            )
            await collapsedPage.evaluate(
              () =>
                new Promise<void>((resolveFrame) =>
                  requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
                )
            )
            assert.equal(await collapsedPage.getByRole('separator').count(), 0)
            assert.equal(
              await collapsedPage.getByRole('button', { name: 'Retry pane resizing' }).count(),
              0,
              'A failed load must not leave a retry control after all splits are removed'
            )
            await collapsedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await collapsedPage
              .getByRole('separator', { name: 'Resize pane columns', exact: true })
              .waitFor()
            await collapsedPage.locator('[data-corvu-resizable-handle]').waitFor()
            assert.equal(collapsedRequests, 2)
            assert.equal(
              await collapsedPage.getByRole('button', { name: 'Retry pane resizing' }).count(),
              0
            )
            assert.equal(await collapsedEditor.inputValue(), 'collapse during failed load')
            assert.deepEqual(collapsedErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result: 'failure after collapse to zero splits restarted on the next split',
                },
              })
            )
            await collapsedPage.close()

            for (const focusTarget of ['editor', 'outside'] as const) {
              const focusPage = await browser.newPage()
              const focusErrors: string[] = []
              let focusRequests = 0
              const retryStarted = deferred<void>()
              const releaseRetry = deferred<void>()
              focusPage.on('pageerror', (error) => focusErrors.push(error.message))
              await focusPage.route(
                (routeUrl) => isControllerFacadeRequest(routeUrl.href),
                async (route) => {
                  focusRequests += 1
                  if (focusRequests === 1) {
                    await route.abort('failed')
                    return
                  }
                  if (focusRequests === 2) {
                    retryStarted.resolve()
                    await releaseRetry.promise
                  }
                  await route.continue()
                }
              )
              await focusPage.goto(url)
              const focusEditor = focusPage.getByRole('textbox', {
                name: 'Editor a',
                exact: true,
              })
              await focusEditor.waitFor()
              await focusEditor.fill('draft before delayed retry')
              await focusPage.evaluate(() =>
                window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
              )
              const focusRetry = focusPage.getByRole('button', {
                name: 'Retry pane resizing',
              })
              await focusRetry.waitFor()
              await focusRetry.focus()
              await focusRetry.press('Enter')
              await retryStarted.promise
              assert.equal(focusRequests, 2)
              if (focusTarget === 'editor') {
                await focusEditor.fill('typed while resize recovery was pending')
                await focusEditor.evaluate((element) => {
                  ;(element as HTMLTextAreaElement).setSelectionRange(7, 18, 'forward')
                })
              } else {
                await focusEditor.evaluate((element) => {
                  element.focus()
                  ;(element as HTMLTextAreaElement).setSelectionRange(2, 8, 'backward')
                })
                await focusPage.getByRole('button', { name: 'Outside focus target' }).focus()
              }
              const expectedValue = await focusEditor.inputValue()
              const expectedSelection = await focusEditor.evaluate((element) => {
                const field = element as HTMLTextAreaElement
                return [field.selectionStart, field.selectionEnd, field.selectionDirection]
              })
              releaseRetry.resolve()
              await focusPage.locator('[data-corvu-resizable-handle]').waitFor()
              await focusPage.evaluate(
                () =>
                  new Promise<void>((resolveFrame) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
                  )
              )
              const expectedFocus =
                focusTarget === 'editor'
                  ? focusEditor
                  : focusPage.getByRole('button', { name: 'Outside focus target' })
              assert.equal(
                await expectedFocus.evaluate((element) => document.activeElement === element),
                true,
                `A delayed successful retry must not steal focus from the ${focusTarget}`
              )
              assert.equal(await focusEditor.inputValue(), expectedValue)
              assert.deepEqual(
                await focusEditor.evaluate((element) => {
                  const field = element as HTMLTextAreaElement
                  return [field.selectionStart, field.selectionEnd, field.selectionDirection]
                }),
                expectedSelection
              )
              assert.equal(await focusPage.locator('[data-corvu-resizable-handle]').count(), 1)
              assert.deepEqual(focusErrors, [])
              console.log(
                JSON.stringify({
                  packedLayoutRetryFocus: {
                    condition,
                    browser: browserType.name(),
                    focusTarget,
                    result: 'delayed retry preserved newer focus, editor text, and selection',
                  },
                })
              )
              await focusPage.close()
            }

            const latePage = await browser.newPage()
            const lateErrors: string[] = []
            latePage.on('pageerror', (error) => lateErrors.push(error.message))
            const startRequest = deferred<void>()
            const releaseRequest = deferred<void>()
            await latePage.route(
              (routeUrl) => isControllerRequest(routeUrl.href),
              async (route) => {
                startRequest.resolve()
                await releaseRequest.promise
                await route.continue()
              }
            )
            await latePage.goto(url)
            const lateEditor = latePage.getByRole('textbox', { name: 'Editor a', exact: true })
            await lateEditor.waitFor()
            await lateEditor.fill('late import draft')
            await lateEditor.evaluate((element) => {
              element.focus()
              ;(element as HTMLTextAreaElement).setSelectionRange(2, 8, 'backward')
              ;(window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity =
                element
            })
            await latePage.evaluate(() =>
              window.dispatchEvent(
                new CustomEvent('packed-layout-lazy', { detail: 'split-column' })
              )
            )
            await startRequest.promise
            const pendingSeparator = latePage.getByRole('separator', {
              name: 'Resize pane rows',
            })
            assert.equal(await pendingSeparator.getAttribute('aria-disabled'), 'true')
            assert.equal(await pendingSeparator.getAttribute('aria-orientation'), 'horizontal')
            assert.equal(
              await pendingSeparator.evaluate((element) => (element as HTMLElement).tabIndex),
              -1
            )
            const [pendingBounds, firstPaneBounds] = await Promise.all([
              pendingSeparator.boundingBox(),
              latePage.getByRole('region', { name: 'Pane a', exact: true }).boundingBox(),
            ])
            assert.ok(pendingBounds && firstPaneBounds)
            assert.ok(
              Math.abs(
                pendingBounds.y +
                  pendingBounds.height / 2 -
                  (firstPaneBounds.y + firstPaneBounds.height)
              ) <= 1,
              `Packed ${condition}/${browserType.name()} pending boundary drifted from pane edge`
            )
            await latePage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'close' }))
            )
            assert.equal(await latePage.getByRole('separator').count(), 0)
            await latePage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            const pendingColumnSeparator = latePage.getByRole('separator', {
              name: 'Resize pane columns',
            })
            assert.equal(await pendingColumnSeparator.getAttribute('aria-disabled'), 'true')
            assert.equal(await pendingColumnSeparator.getAttribute('aria-orientation'), 'vertical')
            const [pendingColumnBounds, firstColumnPaneBounds] = await Promise.all([
              pendingColumnSeparator.boundingBox(),
              latePage.getByRole('region', { name: 'Pane a', exact: true }).boundingBox(),
            ])
            assert.ok(pendingColumnBounds && firstColumnPaneBounds)
            assert.ok(
              Math.abs(
                pendingColumnBounds.x +
                  pendingColumnBounds.width / 2 -
                  (firstColumnPaneBounds.x + firstColumnPaneBounds.width)
              ) <= 1,
              `Packed ${condition}/${browserType.name()} pending column boundary drifted from pane edge`
            )
            await latePage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'close' }))
            )
            assert.equal(await latePage.getByRole('separator').count(), 0)
            assert.equal(await lateEditor.inputValue(), 'late import draft')
            releaseRequest.resolve()
            await latePage.waitForFunction(
              (files) =>
                performance
                  .getEntriesByType('resource')
                  .some((resource) =>
                    files.some((file) => new URL(resource.name).pathname.endsWith(`/${file}`))
                  ),
              [...controllerFiles]
            )
            await latePage.evaluate(
              () =>
                new Promise<void>((resolveFrame) =>
                  requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
                )
            )
            assert.equal(
              await latePage.getByRole('separator').count(),
              0,
              `Packed ${condition} mounted a stale separator after its branch was removed during import`
            )
            assert.equal(await lateEditor.evaluate((element) => element.isConnected), true)
            assert.equal(
              await lateEditor.evaluate(
                (element) =>
                  (window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity ===
                  element
              ),
              true,
              `Packed ${condition} replaced the surviving leaf after a late controller import`
            )
            assert.equal(
              await lateEditor.evaluate((element) => document.activeElement === element),
              true
            )
            assert.deepEqual(
              await lateEditor.evaluate((element) => {
                const field = element as HTMLTextAreaElement
                return [field.selectionStart, field.selectionEnd, field.selectionDirection]
              }),
              [2, 8, 'backward']
            )

            await latePage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'mount' }))
            )
            await latePage.getByRole('textbox', { name: 'Editor a', exact: true }).waitFor()
            await latePage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await latePage.getByRole('separator', { name: 'Resize pane columns' }).waitFor()
            assert.deepEqual(lateErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result: 'late import after branch removal passed',
                },
              })
            )
            await latePage.close()

            const unmountPage = await browser.newPage()
            const unmountErrors: string[] = []
            unmountPage.on('pageerror', (error) => unmountErrors.push(error.message))
            const unmountStarted = deferred<void>()
            const releaseUnmount = deferred<void>()
            await unmountPage.route(
              (routeUrl) => isControllerRequest(routeUrl.href),
              async (route) => {
                unmountStarted.resolve()
                await releaseUnmount.promise
                await route.continue()
              }
            )
            await unmountPage.goto(url)
            await unmountPage.getByRole('textbox', { name: 'Editor a', exact: true }).waitFor()
            await unmountPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await unmountStarted.promise
            await unmountPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'unmount' }))
            )
            assert.equal(await unmountPage.getByRole('group', { name: 'Work panes' }).count(), 0)
            releaseUnmount.resolve()
            await unmountPage.waitForFunction(
              (files) =>
                performance
                  .getEntriesByType('resource')
                  .some((resource) =>
                    files.some((file) => new URL(resource.name).pathname.endsWith(`/${file}`))
                  ),
              [...controllerFiles]
            )
            await unmountPage.evaluate(
              () =>
                new Promise<void>((resolveFrame) =>
                  requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
                )
            )
            assert.equal(await unmountPage.getByRole('group', { name: 'Work panes' }).count(), 0)
            assert.deepEqual(unmountErrors, [])
            await unmountPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'mount' }))
            )
            await unmountPage.getByRole('textbox', { name: 'Editor a', exact: true }).waitFor()
            await unmountPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await unmountPage.getByRole('separator', { name: 'Resize pane columns' }).waitFor()
            for (let cycle = 0; cycle < 3; cycle++) {
              await unmountPage.evaluate(() =>
                window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'unmount' }))
              )
              await unmountPage.waitForFunction(
                () => document.querySelector('[data-slot="split-layout"]') === null
              )
              await unmountPage.evaluate(() =>
                window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'mount' }))
              )
              const cycleEditor = unmountPage.getByRole('textbox', {
                name: 'Editor a',
                exact: true,
              })
              await cycleEditor.waitFor()
              assert.equal(await unmountPage.getByRole('separator').count(), 0)
              await unmountPage.evaluate(() =>
                window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
              )
              await unmountPage
                .getByRole('separator', { name: 'Resize pane columns', exact: true })
                .waitFor()
              assert.equal(await unmountPage.getByRole('separator').count(), 1)
              await cycleEditor.fill(`mount cycle ${cycle + 1}`)
              assert.equal(await cycleEditor.inputValue(), `mount cycle ${cycle + 1}`)
            }
            assert.deepEqual(unmountErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result: 'late import after unmount and three remount cycles passed',
                },
              })
            )
            await unmountPage.close()

            const rejectedPage = await browser.newPage()
            const rejectedErrors: string[] = []
            let controllerRequests = 0
            rejectedPage.on('pageerror', (error) => rejectedErrors.push(error.message))
            await rejectedPage.route(
              (routeUrl) => isControllerFacadeRequest(routeUrl.href),
              (route) => {
                controllerRequests += 1
                return controllerRequests < 3 ? route.abort('failed') : route.continue()
              }
            )
            await rejectedPage.goto(url)
            const rejectedEditor = rejectedPage.getByRole('textbox', {
              name: 'Editor a',
              exact: true,
            })
            await rejectedEditor.waitFor()
            await rejectedEditor.fill('draft survives controller failure')
            await rejectedEditor.evaluate((element) => {
              element.focus()
              ;(element as HTMLTextAreaElement).setSelectionRange(6, 13, 'backward')
              ;(window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity =
                element
            })
            await rejectedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            const retry = rejectedPage.getByRole('button', { name: 'Retry pane resizing' })
            await retry.waitFor()
            assert.equal(await rejectedPage.getByRole('group', { name: 'Work panes' }).count(), 1)
            const loadStatus = rejectedPage.getByText('Resize controls did not load.', {
              exact: true,
            })
            assert.equal(await loadStatus.getAttribute('role'), 'status')
            assert.equal(await loadStatus.count(), 1)
            assert.equal(await rejectedPage.getByRole('alert').count(), 0)
            assert.equal(await rejectedPage.getByRole('separator').count(), 1)
            assert.equal(
              await rejectedPage.getByRole('separator').getAttribute('aria-disabled'),
              'true'
            )
            assert.equal(await rejectedEditor.inputValue(), 'draft survives controller failure')
            assert.equal(await rejectedEditor.evaluate((element) => element.isConnected), true)
            assert.equal(
              await rejectedEditor.evaluate(
                (element) =>
                  (window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity ===
                  element
              ),
              true
            )
            assert.equal(
              await rejectedEditor.evaluate((element) => document.activeElement === element),
              true
            )
            assert.deepEqual(
              await rejectedEditor.evaluate((element) => {
                const field = element as HTMLTextAreaElement
                return [field.selectionStart, field.selectionEnd, field.selectionDirection]
              }),
              [6, 13, 'backward']
            )
            await retry.focus()
            await retry.press('Enter')
            await retry.waitFor()
            assert.equal(controllerRequests, 2)
            assert.equal(await rejectedPage.getByRole('separator').count(), 1)
            assert.equal(await rejectedEditor.evaluate((element) => element.isConnected), true)
            assert.deepEqual(
              await rejectedEditor.evaluate((element) => {
                const field = element as HTMLTextAreaElement
                return [field.selectionStart, field.selectionEnd, field.selectionDirection]
              }),
              [6, 13, 'backward']
            )
            assert.equal(
              await retry.evaluate((element) => document.activeElement === element),
              true,
              'A failed keyboard retry returns focus to the remounted retry action'
            )
            await retry.press('Enter')
            const retrySeparator = rejectedPage.locator('[data-corvu-resizable-handle]')
            try {
              await retrySeparator.waitFor({
                timeout:
                  process.env.ADEA_PACKED_LAYOUT_RETRY_DIAGNOSTIC === '1' ? 5_000 : undefined,
              })
            } catch (error) {
              const retryState = await rejectedPage.evaluate(() => ({
                separatorCount: document.querySelectorAll('[role="separator"]').length,
                disabled: document
                  .querySelector('[role="separator"]')
                  ?.getAttribute('aria-disabled'),
                status: document.querySelector('[role="status"]')?.textContent,
                retryButtonCount: [...document.querySelectorAll('button')].filter((button) =>
                  button.textContent?.includes('Retry pane resizing')
                ).length,
                activeElementTag: document.activeElement?.tagName,
                resourcePaths: performance
                  .getEntriesByType('resource')
                  .map((resource) => new URL(resource.name).pathname),
              }))
              console.error(
                JSON.stringify({
                  packedLayoutRetryDiagnostic: {
                    condition,
                    browser: browserType.name(),
                    controllerRequests,
                    errors: rejectedErrors,
                    state: retryState,
                  },
                })
              )
              throw error
            }
            assert.equal(controllerRequests, 3)
            assert.equal(
              await retrySeparator.evaluate((element) => document.activeElement === element),
              true
            )
            assert.equal(
              await rejectedPage.getByRole('button', { name: 'Retry pane resizing' }).count(),
              0
            )
            assert.equal(await rejectedEditor.inputValue(), 'draft survives controller failure')
            assert.equal(await rejectedEditor.evaluate((element) => element.isConnected), true)
            assert.deepEqual(
              await rejectedEditor.evaluate((element) => {
                const field = element as HTMLTextAreaElement
                return [field.selectionStart, field.selectionEnd, field.selectionDirection]
              }),
              [6, 13, 'backward']
            )
            await rejectedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'close' }))
            )
            assert.equal(await rejectedPage.getByRole('separator').count(), 0)
            await rejectedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await rejectedPage.locator('[data-corvu-resizable-handle]').waitFor()
            assert.equal(
              controllerRequests,
              3,
              'A recovered controller stays cached when the layout temporarily has no split'
            )
            assert.deepEqual(rejectedErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result:
                    'two failed entrypoint requests preserved panes and the third retry recovered',
                },
              })
            )
            await rejectedPage.close()

            const sharedFailurePage = await browser.newPage()
            const sharedFailureErrors: string[] = []
            let sharedControllerRequests = 0
            let retryControllerRequests = 0
            sharedFailurePage.on('pageerror', (error) => sharedFailureErrors.push(error.message))
            await sharedFailurePage.route(
              (routeUrl) =>
                new URL(routeUrl.href).pathname.endsWith(`/${sharedController.fileName}`),
              (route) => {
                sharedControllerRequests += 1
                return sharedControllerRequests === 1 ? route.abort('failed') : route.continue()
              }
            )
            await sharedFailurePage.route(
              (routeUrl) =>
                new URL(routeUrl.href).pathname.endsWith(`/${retryController.fileName}`),
              (route) => {
                retryControllerRequests += 1
                return route.continue()
              }
            )
            await sharedFailurePage.goto(url)
            const sharedFailureEditor = sharedFailurePage.getByRole('textbox', {
              name: 'Editor a',
              exact: true,
            })
            await sharedFailureEditor.waitFor()
            await sharedFailureEditor.fill('shared chunk failure preserves draft')
            await sharedFailureEditor.evaluate((element) => {
              element.focus()
              ;(element as HTMLTextAreaElement).setSelectionRange(5, 16, 'forward')
              ;(window as Window & { packedEditorIdentity?: Element }).packedEditorIdentity =
                element
            })
            await sharedFailurePage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            const sharedRetry = sharedFailurePage.getByRole('button', {
              name: 'Retry pane resizing',
            })
            await sharedRetry.waitFor()
            assert.equal(sharedControllerRequests, 1)
            assert.equal(await sharedFailurePage.getByRole('separator').count(), 1)
            assert.equal(await sharedFailureEditor.evaluate((element) => element.isConnected), true)
            assert.equal(
              await sharedFailureEditor.evaluate((element) => document.activeElement === element),
              true
            )
            await sharedRetry.focus()
            await sharedRetry.press('Enter')
            await sharedRetry.waitFor()
            assert.equal(sharedControllerRequests, 1)
            assert.equal(retryControllerRequests, 0)
            assert.equal(
              await sharedRetry.evaluate((element) => document.activeElement === element),
              true
            )
            await sharedRetry.press('Enter')
            await sharedFailurePage.locator('[data-corvu-resizable-handle]').waitFor()
            assert.equal(sharedControllerRequests, 1)
            assert.equal(retryControllerRequests, 1)
            assert.equal(
              await sharedFailurePage.getByRole('button', { name: 'Retry pane resizing' }).count(),
              0
            )
            assert.equal(
              await sharedFailureEditor.inputValue(),
              'shared chunk failure preserves draft'
            )
            assert.deepEqual(
              await sharedFailureEditor.evaluate((element) => {
                const field = element as HTMLTextAreaElement
                return [field.selectionStart, field.selectionEnd, field.selectionDirection]
              }),
              [5, 16, 'forward']
            )
            assert.equal(
              await sharedFailurePage
                .locator('[data-corvu-resizable-handle]')
                .evaluate((element) => document.activeElement === element),
              true
            )
            assert.deepEqual(sharedFailureErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result: 'failed shared controller chunk recovered through alternate facade',
                },
              })
            )
            await sharedFailurePage.close()

            const exhaustedPage = await browser.newPage()
            const exhaustedErrors: string[] = []
            let exhaustedRequests = 0
            let mainDocumentNavigations = 0
            let reloadNavigations = 0
            let reloadActivatedByUser = false
            exhaustedPage.on('framenavigated', (frame) => {
              if (frame === exhaustedPage.mainFrame()) mainDocumentNavigations += 1
            })
            exhaustedPage.on('request', (request) => {
              if (
                reloadActivatedByUser &&
                request.isNavigationRequest() &&
                request.frame() === exhaustedPage.mainFrame()
              )
                reloadNavigations += 1
            })
            exhaustedPage.on('pageerror', (error) => exhaustedErrors.push(error.message))
            await exhaustedPage.route(
              (routeUrl) => isControllerFacadeRequest(routeUrl.href),
              (route) => {
                exhaustedRequests += 1
                return route.abort('failed')
              }
            )
            await exhaustedPage.goto(url)
            assert.equal(mainDocumentNavigations, 1)
            const exhaustedEditor = exhaustedPage.getByRole('textbox', {
              name: 'Editor a',
              exact: true,
            })
            await exhaustedEditor.waitFor()
            await exhaustedEditor.fill('draft stays visible after retry exhaustion')
            await exhaustedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            const retryUntilExhausted = exhaustedPage.getByRole('button', {
              name: 'Retry pane resizing',
            })
            await retryUntilExhausted.waitFor()
            assert.equal(exhaustedRequests, 1)
            await retryUntilExhausted.focus()
            for (let attempt = 2; attempt <= 3; attempt++) {
              const failedRequest = exhaustedPage.waitForEvent('requestfailed', (request) =>
                isControllerFacadeRequest(request.url())
              )
              await retryUntilExhausted.press('Enter')
              await failedRequest
              await exhaustedPage.evaluate(
                () =>
                  new Promise<void>((resolveFrame) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
                  )
              )
              if (attempt < 3) {
                await retryUntilExhausted.waitFor()
                assert.equal(
                  await retryUntilExhausted.evaluate(
                    (element) => document.activeElement === element
                  ),
                  true,
                  'Repeated keyboard retries should keep the remounted retry action focused'
                )
              }
            }
            assert.equal(exhaustedRequests, 3)
            assert.equal(
              await exhaustedPage.getByRole('button', { name: 'Retry pane resizing' }).count(),
              0
            )
            const reload = exhaustedPage.getByRole('button', {
              name: 'Reload page to retry resizing',
            })
            await reload.waitFor()
            assert.equal(await reload.isEnabled(), true)
            assert.equal(
              await reload.evaluate((element) => document.activeElement === element),
              true,
              'The final failed keyboard retry should focus the reload action'
            )
            const exhaustedStatus = exhaustedPage.getByRole('status')
            assert.equal(
              await exhaustedStatus.innerText(),
              'Resize controls did not load after repeated attempts. Reloading may discard unsaved pane content.'
            )
            const unsavedWarning = exhaustedPage.getByRole('alert')
            assert.equal(
              await unsavedWarning.innerText(),
              'Reloading may discard unsaved pane content.'
            )
            assert.equal(await unsavedWarning.isVisible(), true)
            const warningId = await unsavedWarning.getAttribute('id')
            assert.ok(warningId)
            assert.equal(
              await reload.getAttribute('aria-describedby'),
              warningId,
              'The reload action must reference the unsaved-content warning for assistive technology'
            )
            assert.equal(
              await exhaustedEditor.inputValue(),
              'draft stays visible after retry exhaustion'
            )
            await exhaustedPage.waitForTimeout(250)
            assert.equal(mainDocumentNavigations, 1, 'Exhausting retries must not reload the page')
            assert.equal(reloadNavigations, 0)
            assert.equal(
              await exhaustedEditor.inputValue(),
              'draft stays visible after retry exhaustion'
            )
            await reload.press('Escape')
            assert.equal(
              await reload.evaluate((element) => document.activeElement === element),
              true,
              'Escape leaves focus on the reload action because no modal is open'
            )
            assert.equal(await unsavedWarning.isVisible(), true)
            assert.equal(mainDocumentNavigations, 1)
            assert.equal(reloadNavigations, 0)
            assert.equal(
              await exhaustedEditor.inputValue(),
              'draft stays visible after retry exhaustion'
            )
            const navigationsBeforeActivation = mainDocumentNavigations
            const explicitReload = exhaustedPage.waitForEvent(
              'framenavigated',
              (frame) => frame === exhaustedPage.mainFrame()
            )
            assert.equal(
              await reload.evaluate((element) => document.activeElement === element),
              true
            )
            reloadActivatedByUser = true
            await reload.press('Enter')
            await explicitReload
            await exhaustedPage.waitForLoadState('load')
            assert.equal(reloadNavigations, 1)
            assert.equal(mainDocumentNavigations, navigationsBeforeActivation + 1)
            const reloadedEditor = exhaustedPage.getByRole('textbox', {
              name: 'Editor a',
              exact: true,
            })
            await reloadedEditor.waitFor()
            assert.equal(
              await reloadedEditor.inputValue(),
              '',
              'The keyboard-activated reload starts a fresh layout after preserving the draft until activation'
            )
            assert.deepEqual(exhaustedErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result:
                    'retry exhaustion warns visibly; reload waits for keyboard activation and preserves the draft until navigation',
                },
              })
            )
            await exhaustedPage.close()
          }
        })
      } finally {
        await browser.close()
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}
