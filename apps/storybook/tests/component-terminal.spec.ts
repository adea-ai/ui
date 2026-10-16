import { expect, test, type Locator, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('terminal')
})

test.beforeEach(async ({ page }) => {
  await mountFixture(page, bundle, 'Terminal')
})

const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  )

/** Scroll the output box to the top and let the scroll event be handled. */
async function scrollAway(page: Page, body: Locator) {
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await frames(page)
}

const append = (page: Page, name: 'appendParked' | 'appendRetained', count: number) =>
  page.evaluate(
    ([fn, n]) =>
      (window as unknown as Record<string, (count: number) => void>)[fn as string]?.(n as number),
    [name, count] as const
  )

const invoke = (page: Page, name: 'appendUnfinished' | 'advanceProgress') =>
  page.evaluate((fn) => (window as unknown as Record<string, () => void>)[fn as string]?.(), name)

test('following the tail shows the newest lines', async ({ page }) => {
  const body = page.getByRole('region', { name: 'Output of parked' })
  await expect(body).toContainText('line 99')
  await expect(body).not.toContainText('line 79\n')
  await append(page, 'appendParked', 30)
  await expect(body).toContainText('line 129')
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toHaveCount(0)
})

test('a parked view keeps its lines while output arrives until Jump to latest', async ({
  page,
}) => {
  const body = page.getByRole('region', { name: 'Output of parked' })
  await scrollAway(page, body)
  const before = await body.evaluate((element) => element.scrollTop)

  await append(page, 'appendParked', 50)
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toContainText('50 newer lines')
  // What was on screen when they left is still the mounted window.
  await expect(body).toContainText('line 99')
  await expect(body).toContainText('line 80')
  await expect(body).not.toContainText('line 149')
  expect(await body.evaluate((element) => element.scrollTop)).toBe(before)

  // More output, and reaching the bottom of the parked view, change nothing.
  await append(page, 'appendParked', 50)
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await frames(page)
  await expect(body).not.toContainText('line 199')
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toContainText(
    '100 newer lines'
  )

  await page.getByRole('button', { name: /Jump to latest/ }).click()
  await expect(body).toContainText('line 199')
  await expect(body).not.toContainText('line 99')
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toHaveCount(0)
  await expect(body).toBeFocused()

  // Following again: the next lines are shown as they arrive.
  await append(page, 'appendParked', 5)
  await expect(body).toContainText('line 204')
})

test('a newly unfinished line stays out of the parked view', async ({ page }) => {
  const body = page.getByRole('region', { name: 'Output of parked' })
  await scrollAway(page, body)

  await invoke(page, 'appendUnfinished')

  await expect(body).not.toContainText('building layer')
  const jump = page.getByRole('button', { name: /Jump to latest/ })
  await expect(jump).toContainText('1 newer line')
  await jump.click()
  await expect(body).toContainText('building layer')
})

test('a carriage-return redraw does not rewrite a parked unfinished line', async ({ page }) => {
  const body = page.getByRole('region', { name: 'Output of progress' })
  await expect(body).toContainText('Downloading 10%')
  await scrollAway(page, body)

  await invoke(page, 'advanceProgress')

  await expect(body).toContainText('Downloading 10%')
  await expect(body).not.toContainText('Downloading 20%')
  const jump = page.getByRole('button', { name: /Jump to latest/ })
  await expect(jump).toContainText('1 newer line')
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await frames(page)
  await expect(body).toContainText('Downloading 10%')
  await expect(body).not.toContainText('Downloading 20%')
  await expect(jump).toBeVisible()
  await jump.click()
  await expect(body).toContainText('Downloading 20%')
  await expect(body).not.toContainText('Downloading 10%')
})

test('returning to the end of a parked view with nothing newer resumes following', async ({
  page,
}) => {
  const body = page.getByRole('region', { name: 'Output of parked' })
  await scrollAway(page, body)
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await frames(page)
  await append(page, 'appendParked', 3)
  await expect(body).toContainText('line 102')
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toHaveCount(0)
})

test('copy is the whole output even while parked', async ({ page }) => {
  const body = page.getByRole('region', { name: 'Output of parked' })
  await scrollAway(page, body)
  await append(page, 'appendParked', 50)
  await expect(body).not.toContainText('line 149')
  await page.getByRole('button', { name: 'Copy output' }).first().click({ force: true })
  const expected = Array.from({ length: 150 }, (_, index) => `line ${index}`).join('\n') + '\n'
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected)
})

test('a restart of the output drops the parked position', async ({ page }) => {
  const body = page.getByRole('region', { name: 'Output of parked' })
  await scrollAway(page, body)
  await append(page, 'appendParked', 10)
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toBeVisible()
  await page.evaluate(() => (window as unknown as { restartParked: () => void }).restartParked())
  await expect(body).toContainText('line 1029')
  await expect(page.getByRole('button', { name: /Jump to latest/ })).toHaveCount(0)
})

test('retention that discards the parked lines says so', async ({ page }) => {
  const body = page.getByRole('region', { name: 'Output of retention' })
  await scrollAway(page, body)

  // 100 kept; trimming happens past 164, dropping 65: the oldest 5 of the
  // 40 lines on screen (60..99) are gone.
  await append(page, 'appendRetained', 100)
  await expect(body).toContainText('line 99')
  await expect(page.getByText(/5 of the lines you were reading were discarded/)).toBeVisible()
  await expect(body).not.toContainText('line 199')

  // Past the next trims (195 dropped by line 300) nothing of that view remains
  // and the oldest 40 retained lines, 195 to 234, are shown instead.
  await append(page, 'appendRetained', 100)
  await expect(page.getByText(/The lines you were reading were discarded/)).toBeVisible()
  await expect(body).toContainText('line 195')
  await expect(body).not.toContainText('line 299')
  await page.getByRole('button', { name: /Jump to latest/ }).click()
  await expect(body).toContainText('line 299')
})
