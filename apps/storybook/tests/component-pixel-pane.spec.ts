import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/pixel-pane.tsx'),
        formats: ['iife'],
        name: 'PixelPaneFixture',
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
    '<!doctype html><html lang="en"><head><title>Pixel pane</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('fixed panes keep their pixel width and the flexible pane takes the rest', async ({
  page,
}) => {
  const width = (name: string) =>
    page
      .getByLabel(name, { exact: true })
      .evaluate((element) => element.getBoundingClientRect().width)

  expect(await width('Fixed')).toBeCloseTo(200, 0)
  expect(await width('Rounded')).toBeCloseTo(150, 0)
  expect(await width('Flexible')).toBeCloseTo(600 - 200 - 150, 0)
})

test('a pane clips content wider than itself and never widens the row', async ({ page }) => {
  const pane = page.getByLabel('Too wide', { exact: true })
  expect(
    await pane.evaluate((element) => element.getBoundingClientRect().width)
  ).toBeLessThanOrEqual(300)
  expect(await pane.evaluate((element) => getComputedStyle(element).overflowX)).toBe('hidden')
  const row = page.getByTestId('crowded')
  expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

const read = (page: Page, name: string) =>
  page.getByLabel(name, { exact: true }).evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      width: element.getBoundingClientRect().width,
      background: style.backgroundColor,
      paddingLeft: style.paddingLeft,
      tone: element.style.getPropertyValue('--pane-tone'),
      color: style.color,
      attribute: element.getAttribute('style'),
    }
  })

test('a string style keeps its declarations and the host width still wins', async ({ page }) => {
  const string = await read(page, 'String style')
  expect(string.background).toBe('rgb(1, 2, 3)')
  expect(string.paddingLeft).toBe('10px')
  expect(string.width).toBeCloseTo(200, 0)

  // A flex-basis of the caller's own does not override the host's width.
  const own = await read(page, 'Own basis')
  expect(own.color).toBe('rgb(7, 8, 9)')
  expect(own.width).toBeCloseTo(100, 0)
})

test('an object style keeps its declarations and the host width still wins', async ({ page }) => {
  const object = await read(page, 'Object style')
  expect(object.tone).toBe('kept')
  expect(object.width).toBeCloseTo(100, 0)
})

test('a pane follows width and style changes, between fixed and flexible and between kinds', async ({
  page,
}) => {
  const set = (next: { width: number | undefined; style: 'none' | 'string' | 'object' }) =>
    page.evaluate(
      (value) =>
        (
          window as unknown as {
            paneFixture: { set(next: unknown): void }
          }
        ).paneFixture.set(value),
      next
    )

  expect((await read(page, 'Live')).width).toBeCloseTo(120, 0)

  await set({ width: 260, style: 'none' })
  expect((await read(page, 'Live')).width).toBeCloseTo(260, 0)

  // Fixed with a string, then a larger width: the string stays, the width moves.
  await set({ width: 260, style: 'string' })
  await set({ width: 300, style: 'string' })
  const grown = await read(page, 'Live')
  expect(grown.width).toBeCloseTo(300, 0)
  expect(grown.background).toBe('rgb(1, 2, 3)')

  // String to object at the same width.
  await set({ width: 300, style: 'object' })
  const object = await read(page, 'Live')
  expect(object.width).toBeCloseTo(300, 0)
  expect(object.tone).toBe('kept')
  expect(object.background).toBe('rgba(0, 0, 0, 0)')

  // Fixed to flexible: the style stays, the basis is gone and the pane shares the row.
  await set({ width: undefined, style: 'object' })
  const flexible = await read(page, 'Live')
  expect(flexible.tone).toBe('kept')
  expect(flexible.attribute ?? '').not.toContain('flex-basis')
  expect(flexible.width).toBeCloseTo(300, 0)

  // Flexible with a string, then back to fixed.
  await set({ width: undefined, style: 'string' })
  expect((await read(page, 'Live')).background).toBe('rgb(1, 2, 3)')
  await set({ width: 180, style: 'string' })
  const back = await read(page, 'Live')
  expect(back.width).toBeCloseTo(180, 0)
  expect(back.background).toBe('rgb(1, 2, 3)')

  // Style removed altogether while fixed.
  await set({ width: 180, style: 'none' })
  const bare = await read(page, 'Live')
  expect(bare.width).toBeCloseTo(180, 0)
  expect(bare.background).toBe('rgba(0, 0, 0, 0)')
})
