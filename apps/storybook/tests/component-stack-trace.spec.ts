import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('stack-trace')
})

test.beforeEach(async ({ page }) => {
  await mountFixture(page, bundle, 'Stack trace')
})

type Recorded = {
  copies: { name: string; exact: boolean; length: number }[]
  opened: { case: string; function?: string; raw: string; detailLength: number }[]
}
const recorded = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { recorded: Recorded }).recorded)
const textLength = (region: import('@playwright/test').Locator) =>
  region.evaluate((element) => element.textContent?.length ?? 0)

test('a multi-megabyte header message is cut, says so, and copy still has all of it', async ({
  page,
}) => {
  const region = page.getByRole('region', { name: 'Huge header' })
  await expect(region.getByText('990,000 more characters not shown')).toBeVisible()
  expect(await textLength(region)).toBeLessThan(20_000)

  await region.getByRole('button', { name: 'Copy stack trace' }).click()
  await expect.poll(async () => (await recorded(page)).copies.length).toBe(1)
  expect((await recorded(page)).copies[0]).toMatchObject({ name: 'Huge header', exact: true })
})

test('one frame with ten thousand printed lines shows a bounded head and counts the rest', async ({
  page,
}) => {
  const region = page.getByRole('region', { name: 'Huge frame detail' })
  await expect(region.getByText(/more lines \(.* characters\) not shown/)).toBeVisible()
  await expect(region.getByText(/9,993 more lines/)).toBeVisible()
  expect(await textLength(region)).toBeLessThan(40_000)

  // The host still gets the whole frame: the bound is a display choice.
  await region.getByRole('button', { name: /Open run at \/app\/job\.py:3/ }).click()
  expect((await recorded(page)).opened.at(-1)).toMatchObject({
    case: 'Huge frame detail',
    function: 'run',
    detailLength: 9_996,
  })

  await region.getByRole('button', { name: 'Copy stack trace' }).click()
  await expect.poll(async () => (await recorded(page)).copies.length).toBe(1)
  expect((await recorded(page)).copies[0]).toMatchObject({ name: 'Huge frame detail', exact: true })
})

test('a dependency group of ten thousand frames builds nothing until opened, then pages', async ({
  page,
}) => {
  const region = page.getByRole('region', { name: 'Huge dependency group' })
  const frames = region.locator('[data-slot="stack-frame"]')
  // Only the reader's own two frames exist while the group is folded.
  await expect(frames).toHaveCount(2)

  const toggle = region.getByRole('button', { name: /9,997 dependency frames/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(frames).toHaveCount(202)
  await expect(region.getByRole('button', { name: 'Show 200 more (9,797 hidden)' })).toBeVisible()

  await region.getByRole('button', { name: /Show 200 more/ }).click()
  await expect(frames).toHaveCount(402)
  await expect(region.getByRole('button', { name: 'Show 200 more (9,597 hidden)' })).toBeVisible()

  // Folding it again releases the rows.
  await toggle.click()
  await expect(frames).toHaveCount(2)
})
