import { expect, test } from '@playwright/test'
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
