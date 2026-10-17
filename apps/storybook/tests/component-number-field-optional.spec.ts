import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('number-field-optional'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Number field optional fixture</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('shows a null value as a blank field that is not required', async ({ page }) => {
  const limit = page.getByRole('spinbutton', { name: 'Document limit', exact: true })
  await expect(limit).toHaveValue('')
  await expect(limit).not.toHaveAttribute('required', '')
  await expect(limit).not.toHaveAttribute('aria-invalid', 'true')
})

test('reports a typed value and null when it is cleared', async ({ page }) => {
  const limit = page.getByRole('spinbutton', { name: 'Document limit', exact: true })
  await limit.fill('300')
  await limit.fill('')
  await expect(limit).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Reported changes')).toHaveText('limit=300;limit=null;')
  await limit.blur()
  await expect(limit).toHaveValue('')
})

test('still rejects an out-of-range value and restores the last good value on blur', async ({
  page,
}) => {
  const limit = page.getByRole('spinbutton', { name: 'Document limit', exact: true })
  await limit.fill('250')
  await limit.fill('0')
  await expect(limit).toHaveAttribute('aria-invalid', 'true')
  await expect(limit).toHaveAccessibleDescription(
    'blank uses the global budget Document limit must be between 1 and 1000000.'
  )
  await limit.blur()
  await expect(limit).toHaveValue('250')
  await expect(limit).not.toHaveAttribute('aria-invalid', 'true')
})

test('follows a controlled null and a controlled value', async ({ page }) => {
  const limit = page.getByRole('spinbutton', { name: 'Document limit', exact: true })
  await page.getByRole('button', { name: 'Set limit' }).click()
  await expect(limit).toHaveValue('250')
  await page.getByRole('button', { name: 'Clear limit' }).click()
  await expect(limit).toHaveValue('')
})

test('disabled locks the input and keeps its value', async ({ page }) => {
  const locked = page.getByRole('spinbutton', { name: 'Locked limit', exact: true })
  await expect(locked).toBeDisabled()
  await expect(locked).toHaveValue('500')
})

test('unparsable text is not blank: it reports nothing and does not clear the limit', async ({
  page,
}) => {
  const limit = page.getByRole('spinbutton', { name: 'Document limit', exact: true })
  await limit.fill('250')
  // "250e" is text a number input cannot parse: its value reads '' but validity.badInput is set.
  await limit.press('End')
  await limit.press('e')
  expect(await limit.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(true)
  await expect(limit).toHaveAttribute('aria-invalid', 'true')
  await expect(limit).toHaveAccessibleDescription(
    'blank uses the global budget Document limit must be a valid number.'
  )
  // Only the typed 250 was reported; the bad draft did not report null.
  await expect(page.getByLabel('Reported changes')).toHaveText('limit=250;')
  await limit.blur()
  await expect(limit).toHaveValue('250')
  expect(await limit.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(false)
  await expect(limit).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Reported changes')).toHaveText('limit=250;')
})

test('unparsable text in an empty optional field restores it to blank and reports nothing', async ({
  page,
}) => {
  const limit = page.getByRole('spinbutton', { name: 'Document limit', exact: true })
  await limit.focus()
  await limit.press('e')
  expect(await limit.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(true)
  await expect(limit).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Reported changes')).toHaveText('')
  await limit.blur()
  expect(await limit.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(false)
  await expect(limit).toHaveValue('')
  await expect(limit).not.toHaveAttribute('aria-invalid', 'true')
})

test('a required field calls unparsable text invalid, not missing, and restores its value', async ({
  page,
}) => {
  const count = page.getByRole('spinbutton', { name: 'Required count', exact: true })
  await expect(count).toHaveValue('3')
  await count.press('End')
  await count.press('e')
  await expect(count).toHaveAttribute('aria-invalid', 'true')
  await expect(count).toHaveAccessibleDescription('Required count must be a valid number.')
  await expect(page.getByLabel('Reported changes')).toHaveText('')
  await count.blur()
  await expect(count).toHaveValue('3')
  await expect(count).not.toHaveAttribute('aria-invalid', 'true')
  // A cleared required field is still missing.
  await count.fill('')
  await expect(count).toHaveAccessibleDescription('Required count is required.')
})
