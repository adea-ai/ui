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
          '../../../packages/ui/tests/fixtures/workspace-switcher-marks.tsx'
        ),
        formats: ['iife'],
        name: 'WorkspaceSwitcherMarksFixture',
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
    '<!doctype html><html lang="en"><head><title>Workspace switcher marks</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

for (const variant of ['stable', 'factory'] as const) {
  test(`${variant} marks keep the current workspace's mark in the trigger while the menu is closed, open and reopened`, async ({
    page,
  }) => {
    // Both switchers share the page; the trigger's own subtree is what is counted.
    const trigger = page
      .locator('[data-slot="workspace-switcher"]')
      .nth(variant === 'stable' ? 0 : 1)
    const alphaInTrigger = trigger.locator(`[data-mark="${variant}:Alpha"]`)
    await expect(alphaInTrigger).toHaveCount(1)

    for (const round of [1, 2]) {
      await trigger.click()
      const menu = page.getByRole('menu')
      await expect(menu, `menu opened (round ${round})`).toBeVisible()
      // The trigger still shows the current mark, and the menu row draws its own.
      await expect(alphaInTrigger).toHaveCount(1)
      await expect(
        menu
          .getByRole('menuitemradio', { name: /^Alpha/ })
          .locator(`[data-mark="${variant}:Alpha"]`)
      ).toHaveCount(1)
      await expect(
        menu.getByRole('menuitemradio', { name: /^Beta/ }).locator(`[data-mark="${variant}:Beta"]`)
      ).toHaveCount(1)

      await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(alphaInTrigger, `after close (round ${round})`).toHaveCount(1)
    }
  })
}
