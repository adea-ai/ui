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
          '../../../packages/ui/tests/fixtures/update-dialog-focus.tsx'
        ),
        formats: ['iife'],
        name: 'UpdateDialogFocusFixture',
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
    '<!doctype html><html lang="en"><head><title>Update dialog focus</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

for (const closeMethod of ['Close button', 'Escape']) {
  test(`a menu-opened controlled UpdateDialog restores focus to its stable external opener on ${closeMethod}`, async ({
    page,
  }) => {
    const opener = page.locator('main > button')
    await opener.click()
    await expect
      .poll(() => opener.evaluate((element) => element === document.activeElement))
      .toBe(false)

    const dialog = page.getByRole('dialog', { name: 'Version & updates' })
    await expect(dialog).toBeVisible()
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true)

    if (closeMethod === 'Escape') {
      await page.keyboard.press('Escape')
    } else {
      await page.getByRole('button', { name: 'Close', exact: true }).click()
    }

    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}
