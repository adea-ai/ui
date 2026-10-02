import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
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
          '../../../packages/ui/tests/fixtures/desktop-support.tsx'
        ),
        formats: ['iife'],
        name: 'DesktopSupportFixture',
      },
    },
  })
  const assets = (Array.isArray(result) ? result : [result]).flatMap((item) =>
    'output' in item ? item.output : []
  )
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
    '<html class="dark"><head></head><body><main id="root"></main></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})
test('compact About owns identity, native source, copying, and focus restoration', async ({
  page,
}) => {
  const opener = page.getByRole('button', { name: 'Open about', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'About Cortana' })
  await expect(dialog).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Cortana', exact: true })).toBeVisible()
  await expect(dialog.getByText('About Cortana', { exact: true })).toHaveCount(0)
  await expect(
    dialog.getByText('Cortana evidence workspace for people and AI agents.')
  ).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Copy version info' }).click()
  await expect(page.getByLabel('Copied payload')).toHaveText(
    'Cortana\nVersion 1.2.0\nPlatform: desktop'
  )
  await dialog.getByRole('link', { name: 'View source' }).click()
  await expect(page.getByLabel('Opened URL')).toHaveText('https://example.com/source')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})
test('clipboard failure is safe and retryable', async ({ page }) => {
  await page.getByRole('button', { name: 'Deny clipboard' }).click()
  await page.getByRole('button', { name: 'Open about', exact: true }).click()
  await page.getByRole('button', { name: 'Copy version info' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not copy version info')
  await expect(page.getByText('Private clipboard error')).toHaveCount(0)
})
test('canonical local menu has Index first and no session actions', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings and utilities' }).click()
  await expect(page.getByRole('menuitem')).toHaveText([
    'Index',
    'About',
    'Help Center',
    'Send Feedback',
    'Updates',
    'Settings',
  ])
  await expect(page.getByRole('menuitem', { name: 'Sign in' })).toHaveCount(0)
})
test('help exposes keyboard keys and opens resources through its native adapter', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { name: 'Help Center' })).toBeVisible()
  await expect(page.locator('kbd')).toHaveText(['⌘', ','])
  await page.getByRole('link', { name: 'Project documentation' }).click()
  await expect(page.getByLabel('Opened URL')).toHaveText('https://example.com/docs')
})
test('Help Center embeds without duplicating its dialog heading or introduction', async ({
  page,
}) => {
  const opener = page.getByRole('button', { name: 'Open embedded help', exact: true })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Help Center' })
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true)
  await expect(dialog.getByRole('heading', { name: 'Help Center', exact: true })).toHaveCount(1)
  await expect(
    dialog.getByText('Keyboard shortcuts and resources for Cortana.', { exact: true })
  ).toHaveCount(1)
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(results.violations).toEqual([])
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})
test('updates retain all historical versions, poll progress, and cancel native work', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open updates', exact: true }).click()
  const history = page.getByRole('region', { name: 'Installed changelog' })
  await expect(history).toContainText('Oldest release is preserved.')
  await expect(history).toContainText('0.1.0')
  await page.getByRole('button', { name: 'Install and restart' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  await page.getByRole('button', { name: 'Cancel update' }).click()
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText(
    'Update cancelled'
  )
  await expect(page.getByRole('button', { name: 'Check latest version' })).toBeEnabled()
})
test('About and Help remain accessible without narrow-screen overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await page.getByRole('button', { name: 'Open about', exact: true }).click()
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(results.violations).toEqual([])
})

test('stale progress cannot re-enable cancellation before its native acknowledgement', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Defer cancellation' }).click()
  await page.getByRole('button', { name: 'Open updates', exact: true }).click()
  await page.getByRole('button', { name: 'Install and restart' }).click()
  await page.getByRole('button', { name: 'Cancel update' }).click()
  const cancelling = page.getByRole('button', { name: 'Cancelling…' })
  await expect(cancelling).toBeDisabled()
  await expect
    .poll(async () => Number(await page.getByLabel('Status requests').textContent()))
    .toBeGreaterThan(2)
  await expect(cancelling).toBeDisabled()
  await cancelling.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Cancel requests')).toHaveText('1')
  await page.evaluate(() =>
    (
      window as Window & { desktopSupportResolveCancel?: () => void }
    ).desktopSupportResolveCancel?.()
  )
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText(
    'Update cancelled'
  )
})
