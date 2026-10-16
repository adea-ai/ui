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
