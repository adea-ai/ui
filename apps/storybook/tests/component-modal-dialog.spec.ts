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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/modal-dialog.tsx'),
        formats: ['iife'],
        name: 'ModalDialogFixture',
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
    '<!doctype html><html lang="en"><head><title>Modal dialog</title></head><body><div id="preexisting-inert" inert></div></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

for (const mode of [
  { name: 'modal', modal: true, hidesBackgroundFromAT: true },
  { name: 'non-modal Kobalte', modal: false, hidesBackgroundFromAT: false },
]) {
  test(`${mode.name} mode keeps its title name, restores inert state after async close, and focuses on reopen`, async ({
    page,
  }) => {
    if (!mode.modal) await page.getByRole('button', { name: 'Use non-modal Kobalte layer' }).click()

    const trigger = page.getByRole('button', { name: 'Open workspace details' })
    await trigger.focus()
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: 'Workspace details' })
    const app = page.locator('#app-root')
    const preexistingInert = page.locator('#preexisting-inert')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-label', 'Workspace details')
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true)
    await expect(app).toHaveAttribute('inert', '')
    await expect(preexistingInert).toHaveAttribute('inert', '')
    if (mode.hidesBackgroundFromAT) {
      await expect(app).toHaveAttribute('aria-hidden', 'true')
    } else {
      await expect(app).not.toHaveAttribute('aria-hidden')
    }

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByLabel('Close status')).toHaveText('Closing')
    await expect(app).toHaveAttribute('inert', '')
    await page.evaluate(() => {
      ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
    })
    await expect(dialog).toHaveCount(0)
    await expect(app).not.toHaveAttribute('inert')
    await expect(app).not.toHaveAttribute('aria-hidden')
    await expect(preexistingInert).toHaveAttribute('inert', '')

    await trigger.click()
    await expect(dialog).toBeVisible()
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true)
  })
}

test('an explicit aria-label overrides the title name without replacing the visible heading', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Use custom dialog label' }).click()
  await page.getByRole('button', { name: 'Open workspace details' }).click()

  const dialog = page.getByRole('dialog', { name: 'Custom workspace label' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-label', 'Custom workspace label')
  await expect(page.getByRole('heading', { name: 'Workspace details' })).toBeVisible()
})
