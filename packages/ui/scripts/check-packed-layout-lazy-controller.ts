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
    if (action === 'close') setState((current) => closePane(current, 'b', () => ({ kind: 'leaf', id: 'placeholder' })))
    if (action === 'unmount') setMounted(false)
    if (action === 'mount') {
      setState(createLayoutState({ kind: 'leaf', id: 'a' }))
      setMounted(true)
    }
  }
  window.addEventListener('packed-layout-lazy', act)
  onCleanup(() => window.removeEventListener('packed-layout-lazy', act))
  return <main id="layout-host">
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
}

render(() => <App />, document.getElementById('root')!)
`

const styles = `
html, body, #root { margin: 0; width: 100%; height: 100%; }
#layout-host, [data-slot="split-layout"] { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
[data-pane-id] { position: absolute; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
[data-pane-id] > div { flex: 1; min-width: 0; min-height: 0; overflow: auto; }
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
      chunk.modules.some((id) => id.includes('/split-layout/resize-controller.'))
    )
    if (!controllerChunks.length)
      throw new Error(`Packed ${condition} build omitted its resize controller chunk`)
    const eagerNames = staticClosure(entryChunk, byName)
    const eager = chunks.filter((chunk) => eagerNames.has(chunk.fileName))
    const measurement = {
      condition,
      entry: entryChunk.fileName,
      entryStaticFiles: [...eagerNames],
      corvuFiles: corvuChunks.map((chunk) => chunk.fileName),
      controllerFiles: controllerChunks.map((chunk) => chunk.fileName),
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
    const isControllerRequest = (url: string) => {
      const pathname = new URL(url).pathname.slice(1)
      return [...controllerFiles].some((file) => pathname.endsWith(file))
    }
    for (const browserType of [chromium, webkit] as BrowserType[]) {
      const browser = await browserType.launch({ headless: true })
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
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await startRequest.promise
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
            assert.deepEqual(unmountErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result: 'late import after unmount passed',
                },
              })
            )
            await unmountPage.close()

            const rejectedPage = await browser.newPage()
            const rejectedErrors: string[] = []
            rejectedPage.on('pageerror', (error) => rejectedErrors.push(error.message))
            await rejectedPage.route(
              (routeUrl) => isControllerRequest(routeUrl.href),
              (route) => route.abort('failed')
            )
            await rejectedPage.goto(url)
            await rejectedPage.getByRole('textbox', { name: 'Editor a', exact: true }).waitFor()
            await rejectedPage.evaluate(() =>
              window.dispatchEvent(new CustomEvent('packed-layout-lazy', { detail: 'split' }))
            )
            await rejectedPage.getByRole('alert').waitFor()
            assert.equal(await rejectedPage.getByText('Resize controller failed').count(), 1)
            assert.equal(await rejectedPage.getByRole('separator').count(), 0)
            assert.deepEqual(rejectedErrors, [])
            console.log(
              JSON.stringify({
                packedLayoutLazyRace: {
                  condition,
                  browser: browserType.name(),
                  result: 'rejected controller import reached the error boundary',
                },
              })
            )
            await rejectedPage.close()
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
