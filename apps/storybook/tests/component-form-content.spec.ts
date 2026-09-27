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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/form-content.tsx'),
        formats: ['iife'],
        name: 'FormContentFixture',
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
    '<!doctype html><html lang="en"><head><title>Form contracts</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})
test('combobox renders recoverable no-results content and normal options', async ({ page }) => {
  const input = page.getByRole('combobox', { name: 'Provider', exact: true })
  await input.fill('unavailable')
  await expect(page.getByRole('status')).toHaveText('No matching providers.')
  await input.fill('cal')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Calendar', exact: true })).toBeVisible()
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(input).toHaveValue('Calendar')
})
test('slider submits scalar and range values, updates with keys and resets', async ({ page }) => {
  const form = page.getByRole('form', { name: 'Thresholds', exact: true })
  const values = () =>
    form.evaluate((element) => [...new FormData(element as HTMLFormElement).entries()])
  expect(await values()).toEqual([
    ['relevance', '50'],
    ['bounds', '20'],
    ['bounds', '70'],
  ])
  const relevance = page.getByRole('slider', { name: 'Relevance', exact: true })
  await expect(relevance).toHaveCount(1)
  await relevance.focus()
  await relevance.press('ArrowRight')
  await expect(relevance).toHaveAttribute('aria-valuenow', '51')
  expect(await values()).toEqual([
    ['relevance', '51'],
    ['bounds', '20'],
    ['bounds', '70'],
  ])
  const bounds = page.getByRole('slider', { name: /^Bounds/ })
  await expect(bounds).toHaveCount(2)
  await expect(page.getByRole('slider', { name: 'Bounds minimum', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '20'
  )
  await expect(page.getByRole('slider', { name: 'Bounds maximum', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '70'
  )
  await bounds.nth(1).focus()
  await bounds.nth(1).press('ArrowRight')
  expect(await values()).toEqual([
    ['relevance', '51'],
    ['bounds', '20'],
    ['bounds', '71'],
  ])
  await page.getByRole('button', { name: 'Reset thresholds' }).click()
  expect(await values()).toEqual([
    ['relevance', '50'],
    ['bounds', '20'],
    ['bounds', '70'],
  ])
})

test('controlled slider values and thumb count follow the owning form', async ({ page }) => {
  const form = page.getByRole('form', { name: 'Controlled thresholds' })
  const thumbs = page.getByRole('slider', { name: /^Controlled / })
  const values = () =>
    form.evaluate((element) => new FormData(element as HTMLFormElement).getAll('controlled'))
  await expect(thumbs).toHaveCount(2)
  await thumbs.nth(1).focus()
  await thumbs.nth(1).press('ArrowRight')
  expect(await values()).toEqual(['10', '81'])
  await page.getByRole('button', { name: 'Use scalar', exact: true }).click()
  await expect(thumbs).toHaveCount(1)
  expect(await values()).toEqual(['30'])
  await page.getByRole('button', { name: 'Use range', exact: true }).click()
  await expect(thumbs).toHaveCount(2)
  expect(await values()).toEqual(['10', '80'])
  const ids = await form
    .locator('input[type="range"]')
    .evaluateAll((inputs) => inputs.map((input) => input.id))
  expect(new Set(ids).size).toBe(ids.length)
})
