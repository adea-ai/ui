import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string
const packedRoot = process.env['ADEA_SHEET_FOCUS_PACKED_ROOT']
const packedCondition = process.env['ADEA_SHEET_FOCUS_PACKED_CONDITION']
const uiRoot = packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui')
const entry = packedRoot
  ? resolve(packedRoot, 'sheet.tsx')
  : resolve(uiRoot, 'tests/fixtures/sheet-focus.tsx')

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid')
  throw new Error('Packed Sheet fixture requires an explicit browser condition')

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
              name: 'compiled-sheet-condition',
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
        name: 'SheetFocusFixture',
        cssFileName: 'sheet-focus-fixture',
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
      throw new Error(`Packed Sheet did not select the ${packedCondition} package condition`)
  }
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Sheet focus</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

for (const closeMethod of ['Close button', 'Escape']) {
  test(`a controlled Sheet restores focus to a stable external opener after it blurs on ${closeMethod}`, async ({
    page,
  }) => {
    const opener = page.locator('#sheet-opener')
    await opener.click()

    const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'First sheet action' })).toBeFocused()
    await expect(opener).not.toBeFocused()

    if (closeMethod === 'Escape') {
      await page.keyboard.press('Escape')
    } else {
      await sheet.getByRole('button', { name: 'Close', exact: true }).click()
    }

    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('Sheet preserves caller open-autofocus prevention and then restores its opener', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Toggle custom open autofocus' }).click()
  const opener = page.locator('#sheet-opener')
  await opener.click()

  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  const requestedFocus = sheet.getByRole('button', { name: 'Last sheet action' })
  await expect(sheet).toBeVisible()
  await expect(requestedFocus).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('Sheet preserves caller close-autofocus prevention', async ({ page }) => {
  await page.getByRole('button', { name: 'Toggle custom close autofocus' }).click()
  const opener = page.locator('#sheet-opener')
  await opener.click()

  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  const callerDestination = page.getByRole('button', { name: 'Caller close destination' })
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(sheet).toHaveCount(0)
  await expect(callerDestination).toBeFocused()
  await expect(opener).not.toBeFocused()
})

test('repeated Sheet cycles keep focus trapped and return to the external opener', async ({
  page,
}) => {
  const opener = page.locator('#sheet-opener')
  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  const firstAction = page.getByRole('button', { name: 'First sheet action' })
  const lastAction = page.getByRole('button', { name: 'Last sheet action' })
  const closeButton = page.getByRole('button', { name: 'Close', exact: true })

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(sheet).toBeVisible()

    await firstAction.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(closeButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(firstAction).toBeFocused()

    await lastAction.focus()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(firstAction).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
  }
})

for (const modal of [false, true]) {
  const dialogName = modal ? 'Nested modal action' : 'Nested non-modal action'
  const triggerName = modal ? 'Open nested modal action' : 'Open nested non-modal action'

  test(`Sheet restores its opener after a nested ${modal ? 'modal' : 'non-modal'} dialog closes first`, async ({
    page,
  }) => {
    const opener = page.locator('#sheet-opener')
    await opener.click()

    const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
    const nestedTrigger = sheet.getByRole('button', { name: triggerName })
    await nestedTrigger.click()

    const nestedDialog = page.getByRole('dialog', { name: dialogName })
    await expect(nestedDialog).toBeVisible()
    await expect(nestedDialog.getByRole('button', { name: 'Finish nested action' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(nestedDialog).toHaveCount(0)
    await expect(nestedTrigger).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test('Sheet clears outside-focus tracking when a nested dialog returns focus to its content root', async ({
  page,
}) => {
  const opener = page.locator('#sheet-opener')
  await opener.click()

  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  await sheet
    .getByRole('button', { name: 'Open nested action returning to the Sheet root' })
    .click()

  const nestedDialog = page.getByRole('dialog', { name: 'Nested non-modal action' })
  await expect(nestedDialog).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(nestedDialog).toHaveCount(0)
  await expect(sheet).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('closing does not focus an external opener that was removed', async ({ page }) => {
  await page.locator('#sheet-opener').click()
  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  const opener = page.locator('#sheet-opener')
  await expect(sheet).toBeVisible()

  await page.evaluate(() => {
    ;(window as Window & { closeSheetAndRemoveOpener?: () => void }).closeSheetAndRemoveOpener?.()
  })

  await expect(sheet).toHaveCount(0)
  await expect(opener).toHaveCount(0)
  await expect(page.locator('body')).toBeFocused()
})

test('closing into a newer dialog preserves its focus', async ({ page }) => {
  await page.locator('#sheet-opener').click()
  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  await expect(sheet).toBeVisible()

  await page.evaluate(() => {
    ;(window as Window & { closeSheetIntoNewDialog?: () => void }).closeSheetIntoNewDialog?.()
  })

  await expect(sheet).toHaveCount(0)
  const followUp = page.getByRole('dialog', { name: 'Follow-up dialog' })
  const followUpAction = page.getByRole('button', { name: 'Continue in follow-up' })
  await expect(followUp).toBeVisible()
  await expect(followUpAction).toBeFocused()
})

test('unmounting an open Sheet owner releases pending focus restoration', async ({ page }) => {
  await page.locator('#sheet-opener').click()
  const sheet = page.getByRole('dialog', { name: 'Workspace navigation' })
  await expect(sheet).toBeVisible()

  await page.evaluate(() => {
    ;(window as Window & { unmountSheetOwner?: () => void }).unmountSheetOwner?.()
  })

  await expect(sheet).toHaveCount(0)
  const newerFocus = page.getByRole('button', { name: 'New focus owner' })
  await newerFocus.focus()
  await page.evaluate(
    () =>
      new Promise<void>((finished) =>
        requestAnimationFrame(() => requestAnimationFrame(() => finished()))
      )
  )
  await expect(newerFocus).toBeFocused()
})
