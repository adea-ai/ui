import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('number-field-step'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Number field step fixture</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('passes step to the input and steps the spinner by it', async ({ page }) => {
  const confidence = page.getByRole('spinbutton', { name: 'Default confidence', exact: true })
  await expect(confidence).toHaveAttribute('step', '0.05')
  await expect(confidence).toHaveValue('0.5')

  await confidence.focus()
  await confidence.press('ArrowUp')
  await expect(confidence).toHaveValue('0.55')
  await confidence.press('ArrowUp')
  await expect(confidence).toHaveValue('0.6')
  await expect(confidence).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Reported changes')).toHaveText('confidence=0.55;confidence=0.6;')

  const percent = page.getByRole('spinbutton', { name: 'Percent', exact: true })
  await expect(percent).toHaveAttribute('step', '5')
  await percent.press('ArrowDown')
  await expect(percent).toHaveValue('45')
})

test('accepts decimals on a fractional step without integer={false}', async ({ page }) => {
  const confidence = page.getByRole('spinbutton', { name: 'Default confidence', exact: true })
  await confidence.fill('0.15')
  await expect(confidence).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Reported changes')).toHaveText('confidence=0.15;')
})

test('types a fractional value key by key without the draft being rewritten', async ({ page }) => {
  const confidence = page.getByRole('spinbutton', { name: 'Default confidence', exact: true })
  await confidence.fill('')
  await confidence.pressSequentially('0.05')
  await expect(confidence).toHaveValue('0.05')
  await expect(confidence).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Reported changes')).toContainText('confidence=0.05;')
})

test('rejects a value off the step grid and restores the last good value on blur', async ({
  page,
}) => {
  const confidence = page.getByRole('spinbutton', { name: 'Default confidence', exact: true })
  await confidence.fill('0.12')
  await expect(confidence).toHaveAttribute('aria-invalid', 'true')
  await expect(confidence).toHaveAccessibleDescription(
    '0 to 1; agents can override per record Default confidence must be a multiple of 0.05.'
  )
  await expect(page.getByLabel('Reported changes')).toHaveText('')
  await confidence.blur()
  await expect(confidence).toHaveValue('0.5')
  await expect(confidence).not.toHaveAttribute('aria-invalid', 'true')

  const percent = page.getByRole('spinbutton', { name: 'Percent', exact: true })
  await percent.fill('42')
  await expect(percent).toHaveAttribute('aria-invalid', 'true')
  await percent.fill('45')
  await expect(percent).not.toHaveAttribute('aria-invalid', 'true')
})

test('measures the step grid from min, not from zero', async ({ page }) => {
  const offset = page.getByRole('spinbutton', { name: 'Offset', exact: true })
  await offset.fill('0.75')
  await expect(offset).not.toHaveAttribute('aria-invalid', 'true')
  await offset.fill('0.6')
  await expect(offset).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Offset must be 0.25 plus a multiple of 0.25.')).toBeVisible()
})

test('a field without step keeps whole-number behaviour', async ({ page }) => {
  const workers = page.getByRole('spinbutton', { name: 'Workers', exact: true })
  await expect(workers).toHaveAttribute('step', '1')
  await workers.fill('2.5')
  await expect(workers).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Workers must be a whole number.')).toBeVisible()
})
