import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('model-selector')
})

test.beforeEach(async ({ page }) => {
  await mountFixture(page, bundle, 'Model selector')
})

const setBlocked = (page: import('@playwright/test').Page, blocked: boolean) =>
  page.evaluate((value) => {
    ;(window as Window & { setBlocked?: (blocked: boolean) => void }).setBlocked?.(value)
  }, blocked)

test('an in-flight block closes and prevents opening model and effort controls', async ({
  page,
}) => {
  const short = page.getByRole('group', { name: 'Short picker' })
  const model = short.getByRole('button', { name: 'Model: First' })
  await model.click()
  await expect(page.getByRole('menuitemradio', { name: 'Second' })).toBeVisible()

  await setBlocked(page, true)
  await expect(page.getByRole('menuitemradio', { name: 'Second' })).toHaveCount(0)
  await expect(model).toHaveAttribute('aria-disabled', 'true')
  // aria-disabled is not "disabled" to Playwright, but a forced press must still do nothing.
  await model.click({ force: true })
  await expect(page.getByRole('menuitemradio', { name: 'Second' })).toHaveCount(0)

  await setBlocked(page, false)
  const effort = short.getByRole('button', { name: 'Thinking effort: High' })
  await effort.click()
  await expect(page.getByRole('menuitemradio', { name: 'Low' })).toBeVisible()
  await setBlocked(page, true)
  await expect(page.getByRole('menuitemradio', { name: 'Low' })).toHaveCount(0)
  await expect(effort).toHaveAttribute('aria-disabled', 'true')
  await effort.click({ force: true })
  await expect(page.getByRole('menuitemradio', { name: 'Low' })).toHaveCount(0)

  expect(
    await page.evaluate(() => (window as Window & { selections?: string[] }).selections ?? [])
  ).toEqual([])
})

test('an in-flight block closes and prevents opening the searchable model palette', async ({
  page,
}) => {
  const search = page.getByRole('group', { name: 'Search picker' })
  const model = search.getByRole('button', { name: 'Model: Search model 1' })
  await model.click()
  const input = page.getByPlaceholder('Search models')
  await expect(input).toBeVisible()

  await setBlocked(page, true)
  await expect(input).toHaveCount(0)
  await expect(model).toHaveAttribute('aria-disabled', 'true')
  await model.click({ force: true })
  await expect(input).toHaveCount(0)
})
