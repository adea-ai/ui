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

test('a paged first failure opens when revealed and keyed rows survive reorder and shrink', async ({
  page,
}) => {
  const results = page.getByRole('region', { name: 'Paged test results' })
  const suite = results.getByRole('button', { name: 'Paged suite' })
  await expect(suite).toHaveAttribute('aria-expanded', 'true')

  const failure = results.getByRole('button', { name: 'Paged first failure' })
  await expect(failure).toHaveCount(0)
  await results.getByRole('button', { name: /Show 2 more tests/ }).click()
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(results.getByText('Paged failure details')).toBeVisible()
  await failure.focus()
  await expect(failure).toBeFocused()

  await page.evaluate(() => {
    ;(window as Window & { reorderPagedResults?: () => void }).reorderPagedResults?.()
  })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(failure).toBeFocused()

  await page.evaluate(() => {
    ;(window as Window & { shrinkPagedResults?: () => void }).shrinkPagedResults?.()
  })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(failure).toBeFocused()
  await expect(results.getByRole('button', { name: 'Second row' })).toHaveCount(0)

  await page.evaluate(() => {
    ;(window as Window & { growPagedResults?: () => void }).growPagedResults?.()
  })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(failure).toBeFocused()
  await expect(results.getByRole('button', { name: 'Second row' })).toHaveCount(0)
  await expect(results.getByRole('button', { name: /Show 1 more tests/ })).toBeVisible()
})

test('a reorder never pulls focus back once the user has moved elsewhere', async ({ page }) => {
  const results = page.getByRole('region', { name: 'Paged test results' })
  await results.getByRole('button', { name: /Show 2 more tests/ }).click()
  const failure = results.getByRole('button', { name: 'Paged first failure' })
  await failure.focus()
  await expect(failure).toBeFocused()

  await page.evaluate(() => {
    const outside = document.createElement('button')
    outside.id = 'outside-focus-target'
    outside.textContent = 'Outside'
    document.body.append(outside)
    outside.focus()
  })
  await page.evaluate(() => {
    ;(window as Window & { reorderPagedResults?: () => void }).reorderPagedResults?.()
  })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#outside-focus-target')).toBeFocused()

  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  await page.evaluate(() => {
    ;(window as Window & { growPagedResults?: () => void }).growPagedResults?.()
  })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(failure).not.toBeFocused()
})

test('a first failure arriving during a run opens once and respects a user collapse', async ({
  page,
}) => {
  const results = page.getByRole('region', { name: 'Streaming test results' })
  const suite = results.getByRole('button', { name: 'Streaming suite' })
  await expect(suite).toHaveAttribute('aria-expanded', 'false')

  await page.evaluate(() => {
    ;(window as Window & { reportStreamingFailure?: () => void }).reportStreamingFailure?.()
  })
  await expect(suite).toHaveAttribute('aria-expanded', 'true')

  const failure = results.getByRole('button', { name: 'Streamed failure' })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(results.getByText('Initial streamed failure')).toBeVisible()

  await failure.click()
  await expect(failure).toHaveAttribute('aria-expanded', 'false')
  await page.evaluate(() => {
    ;(window as Window & { updateStreamingFailure?: () => void }).updateStreamingFailure?.()
  })
  await expect(failure).toHaveAttribute('aria-expanded', 'false')
  await expect(results.getByText('Initial streamed failure')).toHaveCount(0)
  await expect(results.getByText('Updated streamed failure')).toHaveCount(0)
})
