import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { expectNoAxeViolations, hasNoHorizontalOverflow, mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('tool')
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 })
  await mountFixture(page, bundle, 'Tool')
})

test('a cancelled call says Cancelled, in words and in the accessible name', async ({ page }) => {
  const line = page.locator('#tool-cancelled')
  await expect(line).toHaveAttribute('data-status', 'cancelled')
  // The word is visible for the sighted reader and spoken once for everyone else.
  await expect(line.locator('[data-slot="badge"]', { hasText: 'Cancelled' })).toBeVisible()
  await expect(line.locator('[data-slot="badge"]')).toHaveAttribute('aria-hidden', 'true')
  expect(await line.evaluate((element) => element.textContent)).toContain('Cancelled')
  // It is not a failure: no error colour, no error section, and not busy.
  await expect(line).not.toHaveAttribute('aria-busy')
  await expect(line.getByText('Error')).toHaveCount(0)
  await expect(line.locator('[data-slot="trace-mark"]')).not.toHaveClass(/text-destructive/)
})

test('a cancelled call keeps what it produced and it is final, not still generating', async ({
  page,
}) => {
  const line = page.locator('#tool-cancelled')
  await expect(line.getByText('(pass) applies every migration twice')).toBeVisible()
  await expect(line.getByText('Generating…')).toHaveCount(0)
})

test('cancelled, denied and failed read as three different things', async ({ page }) => {
  const words = async (id: string) =>
    (await page.locator(`#${id}`).evaluate((element) => element.textContent)) ?? ''
  expect(await words('tool-cancelled')).toContain('Cancelled')
  expect(await words('tool-cancelled')).not.toContain('Denied')
  expect(await words('tool-denied')).toContain('Denied')
  expect(await words('tool-denied')).not.toContain('Cancelled')
  expect(await words('tool-error')).toContain('Failed')
  // A call the host said nothing about makes no claim at all.
  await expect(page.locator('#tool-nostatus')).not.toHaveAttribute('data-status')
  expect(await words('tool-nostatus')).toBe('inspect')
})

test('has no accessibility violations in either theme or at 320px', async ({ page }) => {
  await expectNoAxeViolations(page)
  expect(await hasNoHorizontalOverflow(page)).toBe(true)
})
