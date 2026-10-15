import { expect, test, type Locator, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('secret-input-labels'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Secret input labels fixture</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

/** The clear button that sits beside the input a field label names. */
function clearButton(page: Page, field: string): Locator {
  return page
    .locator('[data-slot="input-group"]', { has: page.getByLabel(field, { exact: true }) })
    .locator('[data-slot="input-group-button"]')
}

/** Tab from `from` to the clear button, as a keyboard user would, and read its tooltip. */
async function tooltipText(page: Page, from: Locator, button: Locator) {
  await page.mouse.move(0, 0)
  await from.focus()
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await expect(button).toHaveAttribute('aria-describedby', /.+/)
  const id = await button.getAttribute('aria-describedby')
  return page.locator(`[id="${id}"][role="tooltip"][data-expanded]`).textContent()
}

test('keeps the API key wording when no labels are given', async ({ page }) => {
  const enabled = clearButton(page, 'Default wording')
  await expect(enabled).toHaveAccessibleName('Clear API key')
  expect(await tooltipText(page, page.getByLabel('Default wording'), enabled)).toBe('Clear API key')

  const locked = clearButton(page, 'Default locked')
  await expect(locked).toHaveAccessibleName('Clear API key')
  expect(await tooltipText(page, enabled, locked)).toBe('This API key is managed by policy')
})

test('names the clear action for the field through clearLabel', async ({ page }) => {
  const bearer = clearButton(page, 'New bearer token')
  await expect(bearer).toHaveAccessibleName('Clear stored bearer token')
  expect(await tooltipText(page, page.getByLabel('New bearer token'), bearer)).toBe(
    'Clear stored bearer token'
  )

  // No FormField: the input takes its own aria-label and the button its clearLabel.
  const bare = page.getByLabel('New token', { exact: true })
  await expect(bare).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Clear stored token', exact: true })).toBeVisible()
})

test('explains why a disabled clear action is unavailable through disabledReason', async ({
  page,
}) => {
  const locked = clearButton(page, 'Token path value')
  await expect(locked).toHaveAccessibleName('Clear stored token path')
  await expect(locked).toHaveAttribute('aria-disabled', 'true')
  expect(await tooltipText(page, clearButton(page, 'New bearer token'), locked)).toBe(
    'Set a token variable name first'
  )
})
