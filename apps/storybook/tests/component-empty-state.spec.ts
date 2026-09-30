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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/empty-state.tsx'),
        formats: ['iife'],
        name: 'EmptyStateFixture',
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
    '<!doctype html><html lang="en"><head><title>Empty states</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('announces loading and errors with a heading and usable retry action', async ({ page }) => {
  const loading = page.locator('[data-slot=empty][role=status]')
  await expect(loading).toHaveAttribute('aria-live', 'polite')
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  await expect(loading.getByRole('heading', { name: 'Loading graph', level: 1 })).toBeVisible()
  await expect(loading.locator('[data-slot=spinner]')).toHaveAttribute('aria-hidden', 'true')

  const error = page.getByRole('alert')
  await expect(error.getByRole('heading', { name: 'Graph unavailable', level: 1 })).toBeVisible()
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  await retry.focus()
  await expect(retry).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Retry loading the graph')
  await retry.click()
  await expect(page.getByLabel('Retries')).toHaveText('1')
})
