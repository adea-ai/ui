import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { buildAppearanceBrowser, renderAppearanceServer } from './appearance-assets'

let script: string
let css: string

test('the composed editor server-renders without a browser or application globals', async () => {
  const html = await renderAppearanceServer()
  expect(html).toContain('data-appearance-editor')
  expect(html).toContain('Appearance mode')
  expect(html).toContain('Light theme')
  expect(html).toContain('Dark theme')
  expect(html).toContain("Uses the palette's intended color.")
})

test.beforeAll(async () => {
  ;({ script, css } = await buildAppearanceBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Appearance fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await page.getByRole('button', { name: 'Appearance settings' }).click()
})

test('the popup and nested controls retain their shared CSS contract', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  const background = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  expect(background).not.toBe('transparent')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const height = await save.evaluate((element) => {
    const probe = document.createElement('div')
    probe.style.height = 'var(--control-height-sm)'
    element.append(probe)
    const expected = probe.getBoundingClientRect().height
    probe.remove()
    return { actual: element.getBoundingClientRect().height, expected }
  })
  expect(height.expected).toBeGreaterThan(20)
  expect(height.actual).toBeCloseTo(height.expected, 1)
  const toggle = page.getByRole('switch', { name: 'Reduce transparency' })
  // The visible control and thumb come from the shared Switch source, not host CSS.
  expect(
    await toggle.evaluate(
      (element) => element.nextElementSibling?.getBoundingClientRect().height ?? 0
    )
  ).toBeGreaterThan(16)
})

test('the narrow popup keeps its final actions inside the viewport after scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const dialog = page.getByRole('dialog', { name: 'Appearance' })
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const box = (await save.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(800)
  await save.click()
  await expect(dialog).toHaveCount(0)
})

test('mode previews and both theme rows remain available through keyboard changes', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: /^Light theme/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeVisible()
  await expect(page.locator('[data-mode="system"] [data-theme-miniature]')).toHaveCount(2)
  await expect(
    page.getByRole('radiogroup', { name: 'Appearance mode' }).getByRole('radio')
  ).toHaveCount(3)
  const system = page.getByRole('radio', { name: 'System', exact: true })
  await system.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeVisible()
  await expect(page.getByText('Typeface', { exact: true })).toHaveCount(0)
})

test('donor helper copy distinguishes palette defaults and explicit overrides', async ({
  page,
}) => {
  await expect(
    page.getByText("Theme default · Uses the palette's intended color.", { exact: true })
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Blue', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByText('Blue · Controls, glyphs, selections, code, and activity.', { exact: true })
  ).toBeVisible()
  await page.getByText('Opaque', { exact: true }).click()
  await expect(page.getByText('Solid surfaces for every theme.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Light theme/ }).click()
  await expect(page.getByRole('option', { name: 'Catppuccin Latte', exact: true })).toBeVisible()
})

test('unsaved theme selection updates live miniatures and Cancel restores the snapshot', async ({
  page,
}) => {
  const preview = page.locator('[data-live-preview]')
  const initial = await preview.evaluate((element) => getComputedStyle(element).color)
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  const menuAccessibility = await new AxeBuilder({ page }).analyze()
  expect(
    menuAccessibility.violations.filter((finding) =>
      ['serious', 'critical'].includes(finding.impact ?? '')
    )
  ).toEqual([])
  await page.getByRole('option', { name: 'Dracula', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Dracula')
  await expect
    .poll(() => preview.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(initial)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect
    .poll(() => preview.evaluate((element) => getComputedStyle(element).color))
    .toBe(initial)
  await expect(page.getByRole('button', { name: 'Appearance settings' })).toBeFocused()
  await page.getByRole('button', { name: 'Appearance settings' }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Adea Dark')
})

test('nested theme-menu Escape closes only the menu; a second Escape rolls back', async ({
  page,
}) => {
  await page.getByText('Light', { exact: true }).click()
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="listbox"]')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toHaveCount(0)
  await expect(page.getByLabel('Draft preference')).toContainText('"mode":"system"')
})

test('custom accent validates before Save and native capabilities remain truthful', async ({
  page,
}) => {
  await page.getByText('Custom', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Custom accent' }).fill('invalid')
  await expect(page.getByRole('textbox', { name: 'Custom accent' })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Frosted', exact: true })).toBeDisabled()
  await expect(
    page.getByText('Transparency is unavailable on this host.', { exact: true })
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Custom accent' }).fill('#2563eb')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Committed preference')).toContainText('#2563eb')
})

test('outside dismissal restores the snapshot and Reset stays reversible', async ({ page }) => {
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked()
  await page.getByText('Dark', { exact: true }).click()
  await page.mouse.click(5, 5)
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toHaveCount(0)
  await expect(page.getByLabel('Draft preference')).toContainText('"mode":"system"')
})

test('a pending save disables changes and duplicate commits', async ({ page }) => {
  await page.evaluate(() => {
    document.body.dataset['pendingSave'] = 'true'
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toHaveAttribute(
    'aria-busy',
    'true'
  )
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Reduce transparency' })).toBeDisabled()
})

test('theme options remain visible and selectable in the narrow popup', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await expect(page.getByRole('option', { name: 'Dracula', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'Dracula', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Dracula')
})

for (const width of [320, 768, 1024, 1440]) {
  test(`composed editor at ${width}px has no overflow or serious accessibility violations`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible()
    const dialog = page.getByRole('dialog', { name: 'Appearance' })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    const result = await new AxeBuilder({ page }).include('[data-appearance-editor]').analyze()
    expect(
      result.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`appearance-${width}.png`) })
  })
}
