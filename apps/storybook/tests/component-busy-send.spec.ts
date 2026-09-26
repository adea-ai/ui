import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import AxeBuilder from '@axe-core/playwright'

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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/busy-send.tsx'),
        formats: ['iife'],
        name: 'BusyFixture',
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
    '<!doctype html><html lang="en"><head><title>Busy send</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})
test('mode choice remains live before typing, changes no execution and restores trigger focus', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  const trigger = page.getByRole('button', { name: 'Send options' })
  await trigger.click()
  const queue = page.getByRole('menuitemradio', { name: /Queue/ })
  await queue.click()
  await expect(trigger).toBeFocused()
  await expect(page.getByLabel('Fired action')).toHaveText('none')
  await page.getByRole('button', { name: 'Enable send' }).click()
  await page.getByRole('button', { name: 'Queue message', exact: true }).click()
  await expect(page.getByLabel('Fired action')).toHaveText('queue')
})
test('arrows wrap, Home/End move, selection and Escape return to trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Send options' })
  await trigger.focus()
  await trigger.press('ArrowDown')
  const steer = page.getByRole('menuitemradio', { name: /Steer/ })
  const queue = page.getByRole('menuitemradio', { name: /Queue/ })
  await expect(steer).toBeFocused()
  await steer.press('ArrowUp')
  await expect(queue).toBeFocused()
  await queue.press('Home')
  await expect(steer).toBeFocused()
  await steer.press('End')
  await expect(queue).toBeFocused()
  await queue.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
test('Tab cycles the enabled rows; outside pointer dismissal preserves its action', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Send options' })
  await trigger.press('ArrowDown')
  await page.getByRole('menuitemradio', { name: /Steer/ }).press('Tab')
  const queue = page.getByRole('menuitemradio', { name: /Queue/ })
  await expect(queue).toBeFocused()
  await queue.press('Tab')
  const steer = page.getByRole('menuitemradio', { name: /Steer/ })
  await expect(steer).toBeFocused()
  await steer.press('Shift+Tab')
  await expect(queue).toBeFocused()
  const outside = page.getByRole('button', { name: 'Enable send' })
  await outside.click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeEnabled()
  // WebKit follows Safari's native pointer focus policy for buttons. Prove
  // dismissal and the outside action, then keyboard reachability without a trap.
  await outside.focus()
  await expect(outside).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
})
test('unavailable modes stay visible with a reason and cannot select or execute', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Block queue' }).click()
  await page.getByRole('button', { name: 'Send options' }).click()
  await expect(page.getByRole('menuitemradio', { name: /Queue/ })).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await expect(page.getByText('Queue operation unavailable')).toBeVisible()
  await page.getByRole('menuitemradio', { name: /Steer/ }).press('Escape')
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeVisible()
})
test('controlled mode updates and selected radio stay in sync', async ({ page }) => {
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Queue/ }).click()
  await page.getByRole('button', { name: 'Restore steer' }).click()
  await page.getByRole('button', { name: 'Send options' }).click()
  await expect(page.getByRole('menuitemradio', { name: /Steer/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect(page.getByText('Ctrl+Enter uses the other action')).toBeVisible()
})
test('a selected action becoming unavailable cannot fire and can recover to steer', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Queue/ }).click()
  await page.getByRole('button', { name: 'Enable send' }).click()
  await page.getByRole('button', { name: 'Block queue' }).click()
  const action = page.getByRole('button', { name: 'Queue message', exact: true })
  await expect(action).toBeDisabled()
  await expect(action).toHaveAccessibleDescription('Queue operation unavailable')
  await action.dispatchEvent('click')
  await expect(page.getByLabel('Fired action')).toHaveText('none')
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Steer/ }).click()
  await page.getByRole('button', { name: 'Steer', exact: true }).click()
  await expect(page.getByLabel('Fired action')).toHaveText('steer')
})
for (const theme of ['light', 'dark']) {
  for (const width of [320, 768, 1024, 1440]) {
    test(`${theme} at ${width}px has no horizontal overflow or serious accessibility findings`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 })
      if (theme === 'dark')
        await page.evaluate(() => document.documentElement.classList.add('dark'))
      await page.getByRole('button', { name: 'Send options' }).click()
      // Capture and audit the settled popover, rather than a scaled/fading
      // entrance frame whose composited colors are still changing.
      await expect
        .poll(() =>
          page
            .getByRole('menu')
            .evaluate((element) =>
              element
                .getAnimations()
                .some((animation) => animation.playState === 'running' || animation.pending)
            )
        )
        .toBe(false)
      await expect
        .poll(() => page.getByRole('menu').evaluate((element) => getComputedStyle(element).opacity))
        .toBe('1')
      await page.screenshot({ path: test.info().outputPath('busy-send.png') })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      const result = await new AxeBuilder({ page }).analyze()
      expect(
        result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
      ).toEqual([])
    })
  }
}
