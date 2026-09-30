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
          '../../../packages/ui/tests/fixtures/input-suggestions.tsx'
        ),
        formats: ['iife'],
        name: 'InputFixture',
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
    '<!doctype html><html lang="en"><head><title>Input suggestions fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('native suggestions preserve arbitrary text, form validation, and independent lists', async ({
  page,
}) => {
  const input = page.getByRole('combobox', { name: 'Function key' })
  const second = page.getByRole('combobox', { name: 'Other suggestions' })
  const listId = await input.getAttribute('list')
  expect(listId).toBeTruthy()
  expect(await second.getAttribute('list')).not.toBe(listId)
  await expect(page.locator(`datalist[id="${listId}"] option`)).toHaveCount(2)
  await input.fill('customteam')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Submitted value')).toHaveText('customteam')
  await input.fill('INVALID')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Submitted value')).toHaveText('customteam')
  expect(
    await input.evaluate((element) => (element as HTMLInputElement).validity.patternMismatch)
  ).toBe(true)
})
