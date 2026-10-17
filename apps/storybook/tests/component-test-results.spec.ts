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

test('a deep chain of suites with one repeated id opens down to its failure', async ({ page }) => {
  const results = page.getByRole('region', { name: 'Deeply nested test results' })
  const failure = results.getByRole('button', { name: 'Deep failure' })
  await expect(failure).toHaveAttribute('aria-expanded', 'true')
  await expect(results.getByText('Deep failure details')).toHaveCount(1)
  await expect(results.getByRole('button', { name: 'Level 40' })).toHaveAttribute(
    'aria-expanded',
    'true'
  )
})

test('a large failure message is bounded, scrolls, and can be shown or copied in full', async ({
  page,
}) => {
  const results = page.getByRole('region', { name: 'Large failure test results' })
  const message = results.getByRole('group', { name: 'Failure message' }).first()
  await expect(message).toBeVisible()

  const metrics = () =>
    message.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      text: element.textContent!.length,
      overflowY: getComputedStyle(element).overflowY,
    }))
  const bounded = await metrics()
  expect(bounded.height).toBeLessThanOrEqual(260)
  expect(bounded.scrollHeight).toBeGreaterThan(bounded.height)
  expect(bounded.overflowY).toBe('auto')
  expect(bounded.text).toBeLessThanOrEqual(4_000)
  await expect(message).toHaveAttribute('tabindex', '0')

  const total = await page.evaluate(
    () => (window as unknown as { bigMessage: string }).bigMessage.length
  )
  await expect(results.getByText(/copy has all of it/)).toBeVisible()
  await expect(results.getByText(`Showing the first`, { exact: false })).toContainText(
    `of ${total.toLocaleString()}`
  )

  // Copy writes the whole message, not the preview.
  await page.evaluate(() => {
    const target = window as Window & { copied?: string[] }
    target.copied = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => void target.copied!.push(value) },
    })
  })
  await results.getByRole('button', { name: /Copy message/ }).click()
  await expect
    .poll(() => page.evaluate(() => (window as Window & { copied?: string[] }).copied!.at(-1)))
    .toBe(await page.evaluate(() => (window as unknown as { bigMessage: string }).bigMessage))

  // Showing all keeps the box bounded and draws every character.
  await results.getByRole('button', { name: /Show all .* characters/ }).click()
  const all = await metrics()
  expect(all.text).toBe(total)
  expect(all.height).toBeLessThanOrEqual(260)
  await expect(results.getByText(/All .* characters shown/)).toBeVisible()
  await expect(results.getByRole('button', { name: /Show all/ })).toHaveCount(0)

  // A short message in the same suite has no note and no copy control of its own.
  const quiet = results.getByRole('button', { name: 'Quiet failure' })
  await quiet.click()
  await expect(results.getByText('Short failure')).toBeVisible()
})

test('a closed test in an open suite builds no detail, however often it is updated', async ({
  page,
}) => {
  const results = page.getByRole('region', { name: 'Lazy detail test results' })
  const reads = () =>
    page.evaluate(() => {
      const counted = (window as unknown as { lazyReads: { diff: number; stack: number } })
        .lazyReads
      return { diff: counted.diff, stack: counted.stack }
    })

  // The suite opened itself on its first failure; the second test is closed.
  await expect(results.getByRole('button', { name: 'Open failure' })).toHaveAttribute(
    'aria-expanded',
    'true'
  )
  const hidden = results.getByRole('button', { name: /Hidden diff r1/ })
  await expect(hidden).toHaveAttribute('aria-expanded', 'false')

  // The one read of `diff` is the check that there is something to disclose. The old body also
  // read it to test it and to hand it to the diff, and read `stack` to build the trace.
  expect(await reads()).toEqual({ diff: 1, stack: 0 })

  // A hidden immutable update replaces the test and reads its diff once, to find it still has one.
  await page.evaluate(() =>
    (window as unknown as { updateLazyResults: () => void }).updateLazyResults()
  )
  await expect(results.getByRole('button', { name: /Hidden diff r2/ })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  expect(await reads()).toEqual({ diff: 2, stack: 0 })

  // Opening it builds the detail, and the diff and stack are drawn from the same values.
  await results.getByRole('button', { name: /Hidden diff r2/ }).click()
  await expect(results.getByText('Error: hidden')).toBeVisible()
  await expect(results.getByRole('region', { name: /^Diff for / })).toHaveCount(1)
  const opened = await reads()
  expect(opened.diff).toBeGreaterThan(2)
  expect(opened.stack).toBeGreaterThan(0)
})
