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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/pagination.tsx'),
        formats: ['iife'],
        name: 'PaginationFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\\n')
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 400 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Pagination</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

// Kobalte puts every control in an <li> under a <ul>; the row has to be declared on
// that list, or previous, the page run and next stack into a column.
test('lays previous, the page run and next out in one row', async ({ page }) => {
  const items = page.locator('nav > ul > li')
  await expect(items.first()).toBeVisible()
  const tops = await items.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top))
  )
  expect(tops.length).toBeGreaterThan(4)
  expect(new Set(tops).size).toBe(1)
})

test('marks the current page', async ({ page }) => {
  await expect(page.locator('[aria-current="page"]')).toHaveText('40')
})
