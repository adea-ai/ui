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
          '../../../packages/ui/tests/fixtures/settings-section.tsx'
        ),
        formats: ['iife'],
        name: 'SettingsSectionFixture',
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
    '<!doctype html><html lang="en"><head><title>Settings sections</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('content body spaces controls and cards without adding an enclosing row border', async ({
  page,
}) => {
  const rowsBody = page.locator('[data-testid="rows-section"] [data-slot="settings-section-body"]')
  const contentBody = page.locator(
    '[data-testid="content-section"] [data-slot="settings-section-body"]'
  )
  const card = page.getByTestId('settings-card')

  await expect(rowsBody).toHaveCSS('border-top-width', '1px')
  await expect(contentBody).toHaveCSS('border-top-width', '0px')
  await expect(contentBody).toHaveCSS('gap', '16px')
  await expect(contentBody).toHaveCSS('display', 'flex')
  await expect(card).toHaveCSS('border-top-width', '1px')
  await expect(page.getByTestId('field-content')).toBeVisible()
  await expect(page.getByText('Settings card')).toBeVisible()
})
