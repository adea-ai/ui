import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string

test.beforeAll(async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/transcript.tsx'),
        formats: ['iife'],
        name: 'TranscriptFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Transcript fixture</title></head><body></body></html>'
  )
  await page.evaluate(() => {
    document.documentElement.dataset['liveObservers'] = '0'
    const NativeObserver = ResizeObserver
    window.ResizeObserver = class extends NativeObserver {
      registered = false
      override observe(element: Element, options?: ResizeObserverOptions) {
        if (!this.registered) {
          this.registered = true
          document.documentElement.dataset['liveObservers'] = String(
            Number(document.documentElement.dataset['liveObservers']) + 1
          )
        }
        super.observe(element, options)
      }
      override disconnect() {
        if (this.registered) {
          this.registered = false
          document.documentElement.dataset['liveObservers'] = String(
            Number(document.documentElement.dataset['liveObservers']) - 1
          )
        }
        super.disconnect()
      }
    }
  })
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('transcript controls keep a measurable themed control height', async ({ page }) => {
  const control = page.getByRole('button', { name: 'Toggle transcript', exact: true })
  await expect(control).toBeVisible()
  await expect
    .poll(() => control.evaluate((element) => parseFloat(getComputedStyle(element).height)))
    .toBeGreaterThan(0)
})

const scroller = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Transcript', exact: true })
const distance = (page: import('@playwright/test').Page) =>
  scroller(page).evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)

async function stream(page: import('@playwright/test').Page) {
  await scroller(page)
    .locator('[data-stream]')
    .evaluate((el) => {
      if (!el.firstChild) throw new Error('Missing text node')
      el.firstChild.nodeValue += '\nStreamed text'.repeat(30)
    })
}

test('native streamed text growth keeps a following reader at the bottom', async ({ page }) => {
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await stream(page)
  await expect.poll(() => distance(page)).toBeLessThan(2)
})

test('restores a parked reader across remount without streamed output rearming follow', async ({
  page,
}) => {
  const restored = page.getByRole('region', { name: 'Restored transcript' })
  await restored.evaluate((element) => {
    element.scrollTop = 100
    element.dispatchEvent(new Event('scroll'))
  })
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await expect.poll(() => restored.evaluate((element) => element.scrollTop)).toBe(100)
  await restored.locator('[data-stream]').evaluate((element) => {
    element.firstChild!.nodeValue += '\nLater output'.repeat(30)
  })
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  )
  expect(await restored.evaluate((element) => element.scrollTop)).toBe(100)
})

test('restores a cached channel offset after a short transcript has replaced the long one', async ({
  page,
}) => {
  await page.evaluate(() => window.dispatchEvent(new Event('adea-open-cached-channel-fixture')))
  const transcript = page.getByRole('region', { name: 'Cached channel transcript' })
  const switchChannel = page.getByRole('button', { name: 'Switch channel' })
  await expect
    .poll(() => transcript.evaluate((element) => element.scrollHeight))
    .toBeGreaterThan(800)
  await transcript.evaluate((element) => {
    element.scrollTop = 420
    element.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => transcript.evaluate((element) => element.scrollTop)).toBe(420)

  await switchChannel.click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(3)
  await expect.poll(() => transcript.evaluate((element) => element.scrollHeight)).toBeLessThan(500)

  await switchChannel.click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(60)
  await expect.poll(() => transcript.evaluate((element) => element.scrollTop)).toBe(420)
})

test('reader input cancels a pending restore without rearming follow on streamed rows', async ({
  page,
}) => {
  await page.evaluate(() => window.dispatchEvent(new Event('adea-open-cached-channel-fixture')))
  const transcript = page.getByRole('region', { name: 'Cached channel transcript' })
  const switchChannel = page.getByRole('button', { name: 'Switch channel' })
  await expect
    .poll(() => transcript.evaluate((element) => element.scrollHeight))
    .toBeGreaterThan(800)
  await transcript.evaluate((element) => {
    element.scrollTop = 420
    element.dispatchEvent(new Event('scroll'))
  })
  await switchChannel.click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(3)
  await switchChannel.click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(60)

  await page.evaluate(() => {
    const target = window as typeof window & {
      testRestoreFrames: FrameRequestCallback[]
      testRestoreNativeRaf: typeof window.requestAnimationFrame
    }
    target.testRestoreFrames = []
    target.testRestoreNativeRaf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      target.testRestoreFrames.push(callback)
      return target.testRestoreFrames.length
    }
  })
  // Re-enter a reset with the long transcript parked, then hold the deferred
  // callback so a user scroll can race it deterministically.
  await switchChannel.click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(3)
  await switchChannel.click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(60)
  await transcript.hover()
  await page.mouse.wheel(0, 160)
  // WebKit delivers wheel scrolling over multiple frames. Capture the completed
  // reader movement, not an intermediate offset before deferred callbacks run.
  await expect.poll(() => transcript.evaluate((element) => element.scrollTop)).toBe(160)
  const readerOffset = await transcript.evaluate((element) => element.scrollTop)
  await page.evaluate(() => {
    const target = window as typeof window & {
      testRestoreFrames: FrameRequestCallback[]
      testRestoreNativeRaf: typeof window.requestAnimationFrame
    }
    const frames = target.testRestoreFrames
    window.requestAnimationFrame = target.testRestoreNativeRaf
    target.testRestoreFrames = []
    target.testRestoreNativeRaf = window.requestAnimationFrame
    for (const frame of frames) frame(performance.now())
  })

  await page.getByRole('button', { name: 'Grow cached channel' }).click()
  await expect(transcript.locator('[data-channel-row]')).toHaveCount(70)
  await expect.poll(() => transcript.evaluate((element) => element.scrollTop)).toBe(readerOffset)
})

test('preserves released follow intent inside the jump threshold and explicit jump resumes it', async ({
  page,
}) => {
  const restored = page.getByRole('region', { name: 'Restored transcript' })
  await restored.evaluate((element) => {
    element.scrollTop -= 30
    element.dispatchEvent(new Event('scroll'))
  })
  const top = await restored.evaluate((element) => element.scrollTop)
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await expect.poll(() => restored.evaluate((element) => element.scrollTop)).toBe(top)
  await restored.locator('[data-stream]').evaluate((element) => {
    element.firstChild!.nodeValue += '\nLater output'.repeat(30)
  })
  await expect.poll(() => restored.evaluate((element) => element.scrollTop)).toBe(top)
  const surface = restored.locator('..')
  await surface.getByRole('button', { name: 'Jump to latest', exact: true }).click()
  await expect(restored).toBeFocused()
  await expect
    .poll(() =>
      restored.evaluate(
        (element) => element.scrollHeight - element.clientHeight - element.scrollTop
      )
    )
    .toBeLessThan(2)
})

test('a small deliberate scroll up releases follow even inside the pill threshold', async ({
  page,
}) => {
  await expect.poll(() => distance(page)).toBeLessThan(2)
  const parked = await scroller(page).evaluate((el) => {
    el.scrollTop -= 30
    el.dispatchEvent(new Event('scroll'))
    return el.scrollTop
  })
  await scroller(page).evaluate((el) => {
    const row = document.createElement('p')
    row.textContent = 'New message'
    el.querySelector('[data-stream]')?.parentElement?.appendChild(row)
  })
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  )
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBeCloseTo(parked, 0)
})

test('the jump control describes an action without inventing message counts', async ({ page }) => {
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await scroller(page).evaluate((el) => {
    el.scrollTop = 0
    el.dispatchEvent(new Event('scroll'))
  })
  await expect(
    scroller(page).locator('..').getByRole('button', { name: 'Jump to latest', exact: true })
  ).toBeVisible()
})

test('growth on an earlier row and viewport resizing preserve follow', async ({ page }) => {
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await scroller(page)
    .locator('p')
    .first()
    .evaluate((el) => {
      el.textContent += '\nEarlier row grows'.repeat(40)
      el.classList.add('whitespace-pre-wrap')
    })
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await stream(page)
  await expect.poll(() => distance(page)).toBeLessThan(2)
  const priorHeight = await scroller(page).evaluate((el) => el.clientHeight)
  await scroller(page).evaluate((el) =>
    el.parentElement?.parentElement?.classList.replace('h-96', 'h-64')
  )
  await expect
    .poll(() => scroller(page).evaluate((el) => el.clientHeight))
    .toBeLessThan(priorHeight)
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await scroller(page)
    .locator('[data-stream]')
    .evaluate((el) => {
      el.textContent = 'Collapsed turn'
    })
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await scroller(page).evaluate((el) =>
    el.parentElement?.parentElement?.classList.replace('h-64', 'h-96')
  )
  await expect.poll(() => scroller(page).evaluate((el) => el.clientHeight)).toBe(priorHeight)
  await stream(page)
  await expect.poll(() => distance(page)).toBeLessThan(2)
})

test('jump and an explicit conversation switch re-arm follow', async ({ page }) => {
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await scroller(page).evaluate((el) => {
    el.scrollTop = 100
    el.dispatchEvent(new Event('scroll'))
  })
  await scroller(page)
    .locator('..')
    .getByRole('button', { name: 'Jump to latest', exact: true })
    .click()
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await stream(page)
  await expect.poll(() => distance(page)).toBeLessThan(2)
  await scroller(page).evaluate((el) => {
    el.scrollTop = 100
    el.dispatchEvent(new Event('scroll'))
  })
  await page.getByRole('button', { name: 'Switch conversation' }).click()
  await expect.poll(() => distance(page)).toBeLessThan(2)
})

test('disabled follow is inert and the host still receives scroll events', async ({ page }) => {
  await page.getByRole('button', { name: 'Toggle follow' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-live-observers', '0')
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0)
  await expect(page.locator('html')).toHaveAttribute('data-live-observers', '0')
  await scroller(page).evaluate((el) => {
    el.scrollTop = 100
    el.dispatchEvent(new Event('scroll'))
  })
  await stream(page)
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  )
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(100)
  await expect(
    scroller(page).locator('..').getByRole('button', { name: 'Jump to latest', exact: true })
  ).toHaveCount(0)
  expect(Number(await page.getByLabel('Host scroll events').textContent())).toBeGreaterThan(0)
})

test('disabled native reading survives remount and re-enable without a bottom yank', async ({
  page,
}) => {
  const restored = page.getByRole('region', { name: 'Restored transcript' })
  await page.getByRole('button', { name: 'Toggle follow' }).click()
  await restored.evaluate((element) => {
    element.scrollTop = 100
    element.dispatchEvent(new Event('scroll'))
  })
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await page.getByRole('button', { name: 'Toggle transcript' }).click()
  await page.getByRole('button', { name: 'Toggle follow' }).click()
  await expect.poll(() => restored.evaluate((element) => element.scrollTop)).toBe(100)
})

test('unmount and repeated remount release the content and viewport observer', async ({ page }) => {
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await expect(page.locator('html')).toHaveAttribute('data-live-observers', '2')
    await page.getByRole('button', { name: 'Toggle transcript' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-live-observers', '0')
    await page.getByRole('button', { name: 'Toggle transcript' }).click()
  }
})

for (const theme of ['light', 'dark']) {
  for (const width of [320, 768, 1024, 1440]) {
    test(`transcript and jump control remain usable at ${width}px in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.evaluate(
        (appearance) => document.documentElement.classList.toggle('dark', appearance === 'dark'),
        theme
      )
      await page.setViewportSize({ width, height: 800 })
      await expect.poll(() => distance(page)).toBeLessThan(2)
      await scroller(page).evaluate((el) => {
        el.scrollTop = 0
        el.dispatchEvent(new Event('scroll'))
      })
      const jump = scroller(page)
        .locator('..')
        .getByRole('button', { name: 'Jump to latest', exact: true })
      await expect(jump).toBeVisible()
      expect(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true
      )
      const result = await new AxeBuilder({ page }).include('main').analyze()
      expect(
        result.violations.filter((violation) =>
          ['serious', 'critical'].includes(violation.impact ?? '')
        )
      ).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`transcript-${theme}-${width}.png`) })
      await jump.focus()
      await page.keyboard.press('Enter')
      await expect.poll(() => distance(page)).toBeLessThan(2)
      await expect(scroller(page)).toBeFocused()
    })
  }
}

test('the transcript server-renders in clean native Node without browser globals', async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid({ ssr: true })],
    ssr: { noExternal: true },
    build: {
      write: false,
      minify: false,
      ssr: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/transcript-ssr.tsx'),
    },
  })
  const chunks = (Array.isArray(result) ? result : [result])
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((asset) => asset.type === 'chunk')
  expect(chunks).toHaveLength(1)
  const directory = await mkdtemp(resolve(tmpdir(), 'adea-transcript-ssr-'))
  try {
    const chunk = chunks[0]
    if (!chunk) throw new Error('Missing SSR chunk')
    await writeFile(resolve(directory, 'fixture.mjs'), chunk.code)
    await writeFile(
      resolve(directory, 'render.mjs'),
      "import { renderTranscript } from './fixture.mjs'; process.stdout.write(renderTranscript());"
    )
    const html = execFileSync(process.execPath, [resolve(directory, 'render.mjs')], {
      encoding: 'utf8',
    })
    expect(html).toContain('data-slot="conversation-content"')
    expect(html).toContain('A server-rendered reply.')
    expect(html).not.toContain('Jump to latest')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
