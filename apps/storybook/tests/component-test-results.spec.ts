import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('test-results')
})

test.beforeEach(async ({ page }) => {
  await mountFixture(page, bundle, 'Test results')
})

test('a collapsed suite stays expandable without mounting rows, and stable keys preserve open state', async ({
  page,
}) => {
  const suite = page.getByRole('button', { name: /Stable suite/ })
  await expect(suite).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: /Stable test/ })).toHaveCount(0)
  await expect(page.getByText('Initial details')).toHaveCount(0)

  await suite.click()
  const testRow = page.getByRole('button', { name: /Stable test/ })
  await expect(testRow).toHaveAttribute('aria-expanded', 'false')
  await testRow.click()
  await expect(testRow).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('Initial details')).toBeVisible()
  await expect(testRow).toBeFocused()

  await page.evaluate(() => {
    ;(window as Window & { replaceResults?: () => void }).replaceResults?.()
  })
  await expect(testRow).toHaveAttribute('aria-expanded', 'true')
  await expect(testRow).toBeFocused()
  await expect(page.getByText('Updated details')).toBeVisible()
})

test('a reported total without suites is useful output, not an empty-state message', async ({
  page,
}) => {
  await page.evaluate(() => {
    ;(window as Window & { showReportedTotal?: () => void }).showReportedTotal?.()
  })
  await expect(page.getByText('10 tests reported')).toBeVisible()
  await expect(page.getByText('No test results')).toHaveCount(0)
})
