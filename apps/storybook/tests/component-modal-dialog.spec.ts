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
  test(`${mode.name} mode restores inert state and opener focus after async owner unmount, and focuses on reopen`, async ({
    page,
  }) => {
    if (!mode.modal) await page.getByRole('button', { name: 'Use non-modal Kobalte layer' }).click()

    const trigger = page.getByRole('button', { name: 'Open workspace details' })
    await trigger.focus()
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')

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

    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByLabel('Close status')).toHaveText('Closing')
    await expect(app).toHaveAttribute('inert', '')
    await page.evaluate(() => {
      ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
    })
    await expect(dialog).toHaveCount(0)
    await expect(app).not.toHaveAttribute('inert')
    await expect(app).not.toHaveAttribute('aria-hidden')
    await expect(preexistingInert).toHaveAttribute('inert', '')
    await expect(trigger).toBeFocused()

    await trigger.press('Enter')
    await expect(dialog).toBeVisible()
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true)
  })
}

test('a known external return-focus ref supports pointer-opened controlled dialogs', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Use explicit return-focus target' }).click()
  const trigger = page.getByRole('button', { name: 'Open workspace details' })
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByLabel('Close status')).toHaveText('Closing')
  await page.evaluate(() => {
    ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
  })

  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('Escape restores focus to the external opener after the async owner closes', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open workspace details' })
  await trigger.focus()
  await trigger.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  const app = page.locator('#app-root')
  await expect(dialog).toBeVisible()
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Close status')).toHaveText('Closing')
  await expect(app).toHaveAttribute('inert', '')
  await page.evaluate(() => {
    ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
  })

  await expect(dialog).toHaveCount(0)
  await expect(app).not.toHaveAttribute('inert')
  await expect(trigger).toBeFocused()
})

test('a caller close-autofocus handler keeps its own focus destination', async ({ page }) => {
  await page.getByRole('button', { name: 'Use custom close focus' }).click()
  const trigger = page.getByRole('button', { name: 'Open workspace details' })
  await trigger.focus()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByLabel('Close status')).toHaveText('Closing')
  await page.evaluate(() => {
    ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
  })

  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Follow-up action' })).toBeFocused()
  await expect(trigger).not.toBeFocused()
})

test('closing a dialog does not steal focus from a newly opened overlay', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open workspace details' })
  await trigger.focus()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  await expect(dialog).toBeVisible()
  await page.evaluate(() => {
    ;(
      window as Window & {
        completeModalDialogCloseIntoNewOverlay?: () => void
      }
    ).completeModalDialogCloseIntoNewOverlay?.()
  })

  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Follow-up dialog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue in follow-up' })).toBeFocused()
})

test('closing does not focus an opener that became inert', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open workspace details' })
  await trigger.focus()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  await expect(dialog).toBeVisible()
  await page.evaluate(() => {
    const triggerButton = [
      ...document.querySelectorAll<HTMLButtonElement>('#app-root button'),
    ].find((button) => button.textContent?.trim() === 'Open workspace details')
    if (!triggerButton) return
    triggerButton.inert = true
    ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
  })

  await expect(dialog).toHaveCount(0)
  await expect(trigger).toHaveAttribute('inert', '')
  await expect(page.locator('body')).toBeFocused()
})

test('closing does not focus an opener that was removed', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open workspace details' })
  await trigger.focus()
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.evaluate(() => {
    const triggerButton = [
      ...document.querySelectorAll<HTMLButtonElement>('#app-root button'),
    ].find((button) => button.textContent?.trim() === 'Open workspace details')
    triggerButton?.remove()
    ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
  })

  await expect(dialog).toHaveCount(0)
  await expect(page.locator('body')).toBeFocused()
})

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

test('aria-labelledby names the dialog ahead of a different aria-label and title', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Use external dialog label' }).click()
  await page.getByRole('button', { name: 'Open workspace details' }).click()

  const dialog = page.getByRole('dialog', { name: 'External workspace name' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-labelledby', 'external-dialog-label')
  await expect(dialog).toHaveAttribute('aria-label', 'Fallback custom workspace label')
  await expect(page.getByRole('heading', { name: 'Workspace details' })).toBeVisible()
})
