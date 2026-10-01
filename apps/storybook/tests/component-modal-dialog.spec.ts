import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string
const packedRoot = process.env['ADEA_MODAL_DIALOG_PACKED_ROOT']
const packedCondition = process.env['ADEA_MODAL_DIALOG_PACKED_CONDITION']
const uiRoot = packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui')
const entry = packedRoot
  ? resolve(packedRoot, 'modal.tsx')
  : resolve(uiRoot, 'tests/fixtures/modal-dialog.tsx')

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid')
  throw new Error('Packed modal fixture requires an explicit browser condition')

test.beforeAll(async () => {
  const result = await build({
    root: uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && packedCondition === 'compiled'
        ? [
            {
              name: 'compiled-modal-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (condition) => condition !== 'solid' && condition !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: packedRoot
      ? { conditions: packedCondition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: false,
      lib: {
        entry,
        formats: ['iife'],
        name: 'ModalDialogFixture',
        cssFileName: 'modal-dialog-fixture',
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
  if (packedRoot) {
    const modules = assets
      .filter((asset) => asset.type === 'chunk')
      .flatMap((asset) => Object.keys(asset.modules))
      .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = packedCondition === 'compiled' ? '/dist/' : '/src/'
    if (!modules.length || modules.some((id) => !id.includes(expected)))
      throw new Error(`Packed modal did not select the ${packedCondition} package condition`)
  }
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

test('the default modal close button stays anchored to the panel after entrance motion', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open workspace details' }).click()

  const dialog = page.getByRole('dialog', { name: 'Workspace details' })
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  await expect(dialog).toBeVisible()
  await expect(close).toBeVisible()
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => {}))
    )
  })

  const panel = await dialog.boundingBox()
  const control = await close.boundingBox()
  expect(panel).not.toBeNull()
  expect(control).not.toBeNull()
  const topInset = control!.y - panel!.y
  const rightInset = panel!.x + panel!.width - (control!.x + control!.width)
  expect(topInset).toBeGreaterThan(8)
  expect(topInset).toBeLessThan(22)
  expect(rightInset).toBeGreaterThan(8)
  expect(rightInset).toBeLessThan(22)
})

test('the settings surface stays inside narrow viewports and leaves its body scrollable', async ({
  page,
}) => {
  const viewports = [
    { width: 1280, height: 900, fontScale: 1 },
    { width: 320, height: 700, fontScale: 1 },
    { width: 390, height: 844, fontScale: 1 },
    { width: 320, height: 700, fontScale: 2 },
    { width: 390, height: 844, fontScale: 2 },
  ]

  await page.getByRole('button', { name: 'Open workspace settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Workspace settings' })
  await expect(dialog).toBeVisible()
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => {}))
    )
  })

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.evaluate((fontScale) => {
      document.documentElement.style.fontSize = `${fontScale * 100}%`
    }, viewport.fontScale)

    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
    expect(bounds!.width).toBeLessThanOrEqual(viewport.width)
    if (viewport.width > 1000) expect(bounds!.width).toBeGreaterThan(1000)

    const scrollRegion = page.getByTestId('settings-scroll-region')
    const scrollMetrics = await scrollRegion.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    expect(scrollMetrics.clientHeight).toBeGreaterThan(0)
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
    const scrollTop = await scrollRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      return element.scrollTop
    })
    expect(scrollTop).toBeGreaterThan(0)
  }
})

test('the settings surface keeps keyboard focus contained and has no axe violations', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open workspace settings' })
  await trigger.focus()
  await trigger.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Workspace settings' })
  const firstAction = dialog.getByRole('button', { name: 'First settings action' })
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  await expect(dialog).toBeVisible()
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true)

  await firstAction.focus()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(firstAction).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Close status')).toHaveText('Closing')
  await page.evaluate(() => {
    ;(window as Window & { completeModalDialogClose?: () => void }).completeModalDialogClose?.()
  })
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

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
