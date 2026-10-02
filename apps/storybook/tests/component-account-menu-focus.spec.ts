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
          '../../../packages/ui/tests/fixtures/account-menu-focus.tsx'
        ),
        formats: ['iife'],
        name: 'AccountMenuFocusFixture',
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
    '<!doctype html><html lang="en"><head><title>Account menu focus</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

for (const closeMethod of ['Close button', 'Escape']) {
  test(`an after-close account action restores focus to its native trigger on ${closeMethod}`, async ({
    page,
  }) => {
    const opener = page.getByRole('button', { name: 'User settings' })
    await opener.click()
    await page.getByRole('menuitem', { name: 'Updates' }).click()

    await expect(page.getByLabel('Selection lifecycle')).toHaveText(
      'selected|after-close:true:true:true:true'
    )

    const dialog = page.getByRole('dialog', { name: 'Version & updates' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toBeFocused()

    if (closeMethod === 'Escape') {
      await page.keyboard.press('Escape')
    } else {
      await page.getByRole('button', { name: 'Close', exact: true }).click()
    }

    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('an unmounted menu clears its pending after-close action', async ({ page }) => {
  await page.getByRole('button', { name: 'Unmount test menu' }).click()
  await page.getByRole('menuitem', { name: 'Remove menu' }).click()

  await expect(page.getByRole('button', { name: 'Unmount test menu' })).toHaveCount(0)
  await page.waitForTimeout(50)
  await expect(page.getByLabel('Cleanup callback')).toHaveText('deferred callback not fired')
})

test('a rail menu can open beside its trigger with its bottom aligned', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Rail settings', exact: true })
  await opener.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect
    .poll(async () => {
      const trigger = await opener.boundingBox()
      const panel = await menu.boundingBox()
      return trigger && panel ? Math.abs(panel.x - trigger.x - trigger.width - 4) : Infinity
    })
    .toBeLessThan(1)
  await expect(menu.locator(':scope > div[aria-hidden="true"] > svg')).toHaveCount(0)
  await expect
    .poll(async () => {
      const trigger = await opener.boundingBox()
      const panel = await menu.boundingBox()
      return trigger && panel
        ? Math.abs(panel.y + panel.height - trigger.y - trigger.height)
        : Infinity
    })
    .toBeLessThan(8)
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})
