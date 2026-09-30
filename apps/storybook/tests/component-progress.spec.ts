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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/progress.tsx'),
        formats: ['iife'],
        name: 'ProgressFixture',
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
    '<!doctype html><html lang="en"><head><title>Progress</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('shows a labeled numeric readout and omits an empty label-only header', async ({ page }) => {
  const bars = page.getByRole('progressbar')
  const labeled = bars.nth(0)
  const compact = bars.nth(1)

  await expect(labeled).toHaveAccessibleName('Preparing archive')
  await expect(labeled).toHaveAttribute('aria-valuenow', '42')
  await expect(page.getByText('42%')).toBeVisible()
  expect(await labeled.evaluate((element) => element.children.length)).toBe(2)

  await expect(compact).toHaveAccessibleName('Refreshing session')
  await expect(compact).toHaveAttribute('aria-valuenow', '64')
  expect(await compact.evaluate((element) => element.children.length)).toBe(1)
  await expect(page.getByText('Refreshing session', { exact: true })).toHaveCount(0)
  await expect(page.getByText('64%', { exact: true })).toHaveCount(0)
})
