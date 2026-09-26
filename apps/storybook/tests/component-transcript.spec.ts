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

const scroller = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Transcript' })
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
  await expect(page.getByRole('button', { name: 'Jump to latest', exact: true })).toBeVisible()
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
  await page.getByRole('button', { name: 'Jump to latest', exact: true }).click()
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
  await expect(page.getByRole('button', { name: 'Jump to latest', exact: true })).toHaveCount(0)
  expect(Number(await page.getByLabel('Host scroll events').textContent())).toBeGreaterThan(0)
})

test('unmount and repeated remount release the content and viewport observer', async ({ page }) => {
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await expect(page.locator('html')).toHaveAttribute('data-live-observers', '1')
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
      const jump = page.getByRole('button', { name: 'Jump to latest', exact: true })
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
