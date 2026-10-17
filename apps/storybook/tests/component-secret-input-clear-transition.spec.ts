import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('secret-input-clear-transition'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Secret input clear transition</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

// `onClear` is read when the group renders and again when it changes: a stored
// secret that is cleared removes the action, and a configured one adds it.
test('the clear action appears when onClear is provided after setup and the input is kept', async ({
  page,
}) => {
  const input = page.getByLabel('Stored token', { exact: true })
  const clear = page.getByRole('button', { name: 'Clear stored token', exact: true })
  await expect(clear).toHaveCount(0)

  await input.fill('typed-secret')
  await input.focus()
  const before = await input.evaluate((element) => {
    ;(element as HTMLInputElement & { marker?: string }).marker = 'same-element'
    return (element as HTMLInputElement).value
  })

  await page.getByRole('button', { name: 'Toggle clear action' }).click()
  await expect(clear).toBeVisible()
  await expect(clear).toBeEnabled()
  await expect(input).toHaveValue(before)
  expect(
    await input.evaluate((element) => (element as HTMLInputElement & { marker?: string }).marker)
  ).toBe('same-element')

  await clear.click()
  await expect(page.getByText('clears: 1')).toBeVisible()
})

test('the clear action disappears when onClear is withdrawn and leaves no inert button', async ({
  page,
}) => {
  const input = page.getByLabel('Stored token', { exact: true })
  const toggle = page.getByRole('button', { name: 'Toggle clear action' })
  const clear = page.getByRole('button', { name: 'Clear stored token', exact: true })

  await toggle.click()
  await expect(clear).toBeVisible()
  await input.fill('typed-secret')
  await input.focus()

  // Withdraw the action from inside the input, so focus never leaves it.
  await page.keyboard.press('F2')
  await expect(clear).toHaveCount(0)
  await expect(page.locator('[data-slot="input-group-button"]')).toHaveCount(0)
  await expect(input).toHaveValue('typed-secret')
  await expect(input).toBeFocused()

  // And back again: the action returns and still works.
  await toggle.click()
  await expect(clear).toBeVisible()
  await clear.click()
  await expect(page.getByText('clears: 1')).toBeVisible()
})
