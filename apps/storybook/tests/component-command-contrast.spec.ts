import AxeBuilder from '@axe-core/playwright'
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
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/command-contrast.tsx'
        ),
        formats: ['iife'],
        name: 'CommandFixture',
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
    '<!doctype html><html lang="en"><head><title>Command contrast fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('Nord command labels and shortcuts retain AA on default and selected rows', async ({
  page,
}) => {
  const input = page.getByRole('combobox', { name: 'Synthetic commands' })
  await expect(input).toBeVisible()
  await input.focus()
  await input.press('ArrowDown')
  await expect(page.getByRole('option', { name: /Search/ })).toBeVisible()
  expect(
    await page
      .getByRole('option', { name: /Search/ })
      .evaluate((element) => getComputedStyle(element).opacity)
  ).toBe('1')
  const audit = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  expect(audit.violations).toEqual([])
  await input.press('ArrowDown')
  const selectedAudit = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  expect(selectedAudit.violations).toEqual([])
  const disabled = page.getByRole('option', { name: 'Unavailable' })
  await expect(disabled).toHaveAttribute('aria-disabled', 'true')
  expect(await disabled.evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
  await page.getByRole('option', { name: /Search/ }).click()
  await expect(page.getByLabel('Selected command')).toHaveText('search')
})
