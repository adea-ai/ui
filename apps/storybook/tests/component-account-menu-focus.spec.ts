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

test('a shortcut glyph stays out of the item accessible name', async ({ page }) => {
  await page.getByRole('button', { name: 'Shortcut menu' }).click()

  const settings = page.getByRole('menuitem', { name: 'Settings', exact: true })
  await expect(settings).toBeVisible()
  await expect(settings).toHaveAttribute('aria-keyshortcuts', 'Meta+,')
  await expect(settings.locator('[aria-hidden="true"]').last()).toHaveText('⌘,')
})

test('a pending update marks the trigger and the updates row, in words and in a dot', async ({
  page,
}) => {
  // The dot is aria-hidden, so the trigger's name carries the state.
  const trigger = page.getByRole('button', { name: 'Pending update, update available' })
  await expect(trigger).toBeVisible()
  await expect(trigger.locator('[data-slot="account-menu-update-dot"]')).toHaveCount(1)

  await trigger.click()
  const updates = page.getByRole('menuitem', { name: 'Updates, update available', exact: true })
  await expect(updates).toBeVisible()
  await expect(updates.locator('[data-slot="account-menu-update-dot"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
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

test('a rail tooltip keeps its positioning separate from the reopened menu', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const opener = page.getByRole('button', { name: 'Rail settings', exact: true })
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    // This spec is about the tooltip's position against the reopened menu, not
    // about which focus kind announced it: a real hover opens the tip in every
    // engine (keyboard-intent announce is covered in the tooltip lane). Move
    // the pointer off first — the previous width's click parked it on the
    // opener, and an already-hovered trigger fires no new enter.
    await page.mouse.move(4, 320)
    await opener.hover()
    await expect(page.getByRole('tooltip')).toBeVisible()
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
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    console.log(
      'AFTER-ESCAPE FOCUS:',
      await page.evaluate(() => {
        const active = document.activeElement
        return `${active?.tagName}.${active?.getAttribute('aria-label') ?? active?.id ?? ''} phantom-listener:${'n/a'}`
      })
    )
    await expect(opener).toBeFocused()
  }
  expect(errors).toEqual([])
})
