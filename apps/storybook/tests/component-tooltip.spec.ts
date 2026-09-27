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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/tooltip.tsx'),
        formats: ['iife'],
        name: 'TooltipFixture',
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
    '<!doctype html><html lang="en"><head><title>Tooltip</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('the tooltip arrow defaults on and updates when hideArrow changes', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Press ArrowRight to toggle the tooltip arrow' })
  await trigger.focus()

  const tooltip = page.getByRole('tooltip')
  const arrow = tooltip.locator('[aria-hidden="true"]')
  await expect(tooltip).toBeVisible()
  await expect(arrow).toHaveCount(1)
  await expect(page.getByLabel('Arrow visibility')).toHaveText('shown')

  await trigger.press('ArrowRight')
  await expect(tooltip).toBeVisible()
  await expect(page.getByLabel('Arrow visibility')).toHaveText('hidden')
  await expect(arrow).toHaveCount(0)

  await trigger.press('ArrowRight')
  await expect(tooltip).toBeVisible()
  await expect(page.getByLabel('Arrow visibility')).toHaveText('shown')
  await expect(arrow).toHaveCount(1)
})
