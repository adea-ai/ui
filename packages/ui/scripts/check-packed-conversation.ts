/** Actual tarball pilot for the pending shared conversation composition. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, webkit, expect } from '@playwright/test'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'

const root = resolve(import.meta.dir, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-packed-conversation-'))
console.log(`Owned pilot runner PID: ${process.pid}`)
// First packed baseline: 23,880/23,936 gzip JS bytes and 40,203 raw CSS bytes.
// Small fixture-specific headroom; module exclusions remain independent gates.
const MAX_GZIP_BYTES = 26 * 1024
const MAX_CSS_BYTES = 42 * 1024
// Busy menu baseline: 50,308/50,470 gzip JS bytes; CSS shares the 42 KiB cap.
const MAX_BUSY_GZIP_BYTES = 50 * 1024
const results: unknown[] = []
const fixture = `
import { render } from 'solid-js/web';
import { createSignal, For } from 'solid-js';
import { ConversationSurface, MessageComposer } from '@adea-ai/ui/components/conversation';
import './style.css';
function Pilot() {
  const [draft, setDraft] = createSignal('');
  const [tail, setTail] = createSignal('Streaming response');
  const [sends, setSends] = createSignal(0);
  const [fail, setFail] = createSignal(true);
  return <main class="flex h-96 flex-col gap-2 p-4">
    <h1>Shared conversation pilot</h1>
    <ConversationSurface role="log" aria-label="Transcript">
      <For each={Array.from({length: 30}, (_, i) => i)}>{i => <p>Retained event {i}: readable earlier content in the transcript.</p>}</For>
      <p data-tail>{tail()}</p>
    </ConversationSurface>
    <MessageComposer value={draft()} onValueChange={setDraft} onSubmit={() => {
      if (fail()) throw new Error('Disposable transport refusal');
      setSends(sends() + 1); setDraft('');
    }} />
    <button type="button" onClick={() => setFail(false)}>Recover transport</button>
    <button type="button" onClick={() => setTail(tail() + ' streamed text'.repeat(100))}>Grow response</button>
    <output aria-label="Delivered count">{sends()}</output>
  </main>;
}
render(Pilot, document.getElementById('app')!);
`
const busyFixture = `
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { BusySendButton } from '@adea-ai/ui/components/conversation';
import './style.css';
function Pilot() {
  const [mode, setMode] = createSignal('steer');
  const [disabled, setDisabled] = createSignal(true);
  const [blocked, setBlocked] = createSignal(false);
  const [fired, setFired] = createSignal('none');
  return <main class="p-4">
    <h1>Shared busy action pilot</h1>
    <BusySendButton mode={mode()} onModeChange={setMode} disabled={disabled()}
      unavailable={blocked() ? {queue: 'Queue operation unavailable'} : {}}
      onFire={() => setFired(mode())} />
    <div class="mt-64 flex gap-2">
      <button type="button" onClick={() => setDisabled(false)}>Enable send</button>
      <button type="button" onClick={() => setBlocked(true)}>Block queue</button>
      <button type="button" onClick={() => setMode('steer')}>Restore steer</button>
    </div>
    <output aria-label="Fired action">{fired()}</output>
  </main>;
}
render(Pilot, document.getElementById('app')!);
`
try {
  const [archive] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
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
  execFileSync('bun', ['install', '--ignore-scripts'], {
    cwd: consumer,
    stdio: 'pipe',
    timeout: 120_000,
  })
  const notice = readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist/NOTICE'), 'utf8')
  for (const heading of [
    'Composer IME input ownership translated from KiroCrew',
    'Plain transcript follow translated from KiroCrew',
    'Busy composer action translated from KiroCrew',
  ]) {
    if (!notice.includes(heading)) throw new Error(`Packed NOTICE lost ${heading}`)
  }
  if (
    !readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist/LICENSE'), 'utf8').includes(
      'Apache License'
    )
  )
    throw new Error('Packed LICENSE missing')
  for (const pilot of ['conversation', 'busy'] as const) {
    for (const condition of ['compiled', 'solid'] as const) {
      const dir = join(consumer, pilot + '-' + condition)
      mkdirSync(dir)
      writeFileSync(
        join(dir, 'index.html'),
        '<div id="app"></div><script type="module" src="/main.tsx"></script>'
      )
      writeFileSync(join(dir, 'main.tsx'), pilot === 'conversation' ? fixture : busyFixture)
      writeFileSync(
        join(dir, 'style.css'),
        "@import 'tailwindcss';\n@import '@adea-ai/ui/theme.css';\n@import '@adea-ai/ui/base.css';\n" +
          (pilot === 'conversation'
            ? ['conversation', 'ui/button', 'ui/textarea', 'ui/spinner', 'ui/kbd']
            : [
                'conversation/busy-send-button.tsx',
                'ui/button',
                'ui/button-group',
                'ui/dropdown-menu',
              ]
          )
            .map((path) => `@source '../node_modules/@adea-ai/ui/src/components/${path}';\n`)
            .join('')
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
      if (js.length !== 1)
        throw new Error('Conversation pilot unexpectedly emitted additional JS chunks')
      const modules = js.flatMap((chunk) =>
        Object.entries(chunk.modules)
          .filter(([, value]) => value.renderedLength > 0)
          .map(([id]) => id)
      )
      const uiModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
      const expected = condition === 'compiled' ? '/dist/' : '/src/'
      if (!uiModules.some((id) => id.includes(expected)))
        throw new Error(`Wrong ${condition} export selection`)
      if (uiModules.some((id) => id.includes(condition === 'compiled' ? '/src/' : '/dist/')))
        throw new Error('Mixed UI conditions')
      const forbidden = modules.filter((id) =>
        /chart\.js|solid-chartjs|embla|xterm|codemirror|shiki|storybook|@adea-ai\/themes|\/components\/(?:theme|layout)|\/lib\/themes/.test(
          id
        )
      )
      if (forbidden.length) throw new Error(`Unrelated retained modules: ${forbidden.join(', ')}`)
      const unrelatedConversation = uiModules.filter((id) =>
        pilot === 'busy'
          ? /\/conversation\/(?:message-composer|conversation-surface|ime-guard|scroll-follow)/.test(
              id
            )
          : /\/conversation\/busy-send-button/.test(id)
      )
      if (unrelatedConversation.length)
        throw new Error(`Unrelated conversation units: ${unrelatedConversation.join(', ')}`)
      const solidRoots = new Set(
        modules
          .filter((id) => id.includes('/node_modules/solid-js/'))
          .map((id) =>
            id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
          )
      )
      if (solidRoots.size !== 1)
        throw new Error(`Expected one Solid runtime, got ${solidRoots.size}`)
      if (chunks.some((chunk) => /\.woff2?$/.test(chunk.fileName)))
        throw new Error('Unexpected font asset')
      const code = js.map((chunk) => chunk.code).join('\n')
      const css = chunks
        .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
        .map((chunk) => (chunk.type === 'asset' ? String(chunk.source) : ''))
        .join('\n')
      if (gzipSync(code).length > (pilot === 'conversation' ? MAX_GZIP_BYTES : MAX_BUSY_GZIP_BYTES))
        throw new Error(`Packed ${pilot} exceeds its gzip JS budget`)
      if (Buffer.byteLength(css) > MAX_CSS_BYTES)
        throw new Error(`Packed ${pilot} exceeds its raw CSS budget`)
      for (const [engine, browserType] of [
        ['chromium', chromium],
        ['webkit', webkit],
      ] as const) {
        const browser = await browserType.launch({ headless: true })
        try {
          const page = await browser.newPage({ viewport: { width: 768, height: 700 } })
          const errors: string[] = []
          page.on('pageerror', (error) => errors.push(error.message))
          await page.setContent('<div id="app"></div>')
          await page.addStyleTag({ content: css })
          await page.addScriptTag({ type: 'module', content: code })
          if (pilot === 'busy') {
            const trigger = page.getByRole('button', { name: 'Send options' })
            await expect(trigger).toBeVisible()
            await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
            await trigger.press('ArrowDown')
            const steer = page.getByRole('menuitemradio', { name: /Steer/ })
            const queue = page.getByRole('menuitemradio', { name: /Queue/ })
            await expect(steer).toBeFocused()
            await steer.press('Tab')
            await expect(queue).toBeFocused()
            await queue.press('Enter')
            await expect(trigger).toBeFocused()
            await expect(page.getByLabel('Fired action')).toHaveText('none')
            await page.getByRole('button', { name: 'Enable send' }).click()
            const fire = page.getByRole('button', { name: 'Queue message', exact: true })
            await fire.click()
            await expect(page.getByLabel('Fired action')).toHaveText('queue')
            await page.getByRole('button', { name: 'Block queue' }).click()
            await expect(fire).toBeDisabled()
            await expect(
              page.getByText('Queue operation unavailable', { exact: true })
            ).toBeVisible()
            await trigger.press('ArrowDown')
            await expect(queue).toHaveAttribute('aria-disabled', 'true')
            await steer.press('Enter')
            await expect(trigger).toBeFocused()
            await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeEnabled()
            const geometry = await trigger.evaluate((element) => {
              const rect = element.getBoundingClientRect()
              const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
              return { width: rect.width, height: rect.height, expected: (28 * size) / 16 }
            })
            if (
              Math.abs(geometry.width - geometry.expected) > 0.5 ||
              Math.abs(geometry.height - geometry.expected) > 0.5
            )
              throw new Error('Packed icon control lost square height tokens')
            if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
            results.push({
              pilot,
              condition,
              engine,
              checks: [
                'disabled-fire-live-picker',
                'scoped-tab-cycle',
                'controlled-selection-focus',
                'fire-only-execution',
                'unavailable-recovery',
                'square-control-style',
              ],
              js: Buffer.byteLength(code),
              gzip: gzipSync(code).length,
              css: Buffer.byteLength(css),
              chunks: js.length,
              retainedModules: modules,
            })
            continue
          }
          const field = page.getByRole('textbox', { name: 'Message', exact: true })
          await field.waitFor()
          await field.fill('Keep my failed draft')
          await field.press('Enter')
          await page.getByText('Message not sent.', { exact: false }).waitFor()
          if ((await field.inputValue()) !== 'Keep my failed draft')
            throw new Error('Failure lost draft')
          await page.getByRole('button', { name: 'Recover transport' }).click()
          await field.press('Enter')
          await page.waitForFunction(() => document.querySelector('output')?.textContent === '1')
          if ((await field.inputValue()) !== '')
            throw new Error('Successful send did not clear controlled draft')
          await field.fill('IME candidate')
          const candidatePrevented = await field.evaluate((element) => {
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              isComposing: true,
              bubbles: true,
              cancelable: true,
            })
            element.dispatchEvent(event)
            return event.defaultPrevented
          })
          if (candidatePrevented)
            throw new Error('Packed composer prevented native candidate default')
          const latchPrevented = await field.evaluate((element) => {
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
            element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true,
            })
            element.dispatchEvent(event)
            return event.defaultPrevented
          })
          if (!latchPrevented) throw new Error('Packed composer lost post-composition Enter latch')
          if (
            (await page.locator('output').textContent()) !== '1' ||
            (await field.inputValue()) !== 'IME candidate'
          )
            throw new Error('Packed composer sent candidate commit')
          await page.waitForTimeout(70)
          await field.press('Enter')
          await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')
          const scroller = page.getByRole('log', { name: 'Transcript' })
          await scroller.evaluate((element) => {
            element.scrollTop = element.scrollHeight
            element.dispatchEvent(new Event('scroll'))
          })
          await scroller.evaluate((element) => {
            element.scrollTop -= 30
            element.dispatchEvent(new Event('scroll'))
          })
          const before = await scroller.evaluate((element) => element.scrollTop)
          await page.getByRole('button', { name: 'Grow response' }).click()
          await page.waitForFunction(
            () => document.querySelector('[data-tail]')!.textContent!.length > 1000
          )
          await page.waitForTimeout(100)
          if (Math.abs((await scroller.evaluate((element) => element.scrollTop)) - before) > 2)
            throw new Error('Packed follow yanked the reader')
          await page.getByRole('button', { name: 'Jump to latest' }).click()
          const bottom = await scroller.evaluate(
            (element) => element.scrollHeight - element.clientHeight - element.scrollTop
          )
          if (bottom > 2) throw new Error('Packed jump did not reach bottom')
          if (!(await scroller.evaluate((element) => document.activeElement === element)))
            throw new Error('Packed jump lost keyboard focus')
          if ((await field.evaluate((element) => getComputedStyle(element).resize)) !== 'none')
            throw new Error('Packed Tailwind composer styles missing')
          if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
          results.push({
            pilot,
            condition,
            engine,
            checks: [
              'failed-draft',
              'recovered-send',
              'native-ime-default',
              'ime-commit-latch',
              'reader-intent',
              'jump-focus',
              'tailwind-style',
            ],
            js: Buffer.byteLength(code),
            gzip: gzipSync(code).length,
            css: Buffer.byteLength(css),
            chunks: js.length,
            retainedModules: modules,
          })
        } finally {
          await browser.close()
        }
      }
    }
  }
  console.log(JSON.stringify({ archive: archive.filename, results }, null, 2))
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
