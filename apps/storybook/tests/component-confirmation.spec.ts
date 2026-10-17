import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }

test.beforeAll(async () => {
  bundle = await bundleFixture('confirmation')
})

test.beforeEach(async ({ page }) => {
  await mountFixture(page, bundle, 'Confirmation')
})

test('pending execution gives disabled choices a reason', async ({ page }) => {
  const card = page.locator('#confirmation')
  const approve = card.getByRole('button', { name: 'Approve' })
  const deny = card.getByRole('button', { name: 'Deny' })
  const reason = 'Your answer is being sent.'

  await approve.click()
  await expect(approve).toHaveAttribute('aria-disabled', 'true')
  await expect(deny).toHaveAttribute('aria-disabled', 'true')
  await expect(card.getByText(reason, { exact: true })).toBeVisible()
  await expect(approve).toHaveAccessibleDescription(reason)
  await expect(deny).toHaveAccessibleDescription(reason)

  await page.evaluate(() =>
    (window as Window & { resolveApproval?: () => void }).resolveApproval?.()
  )
  await expect(card.getByText(reason, { exact: true })).toHaveCount(0)
})

test('a blank host reason does not disable approval without explanation', async ({ page }) => {
  const card = page.locator('#blank-reason')
  const approve = card.getByRole('button', { name: 'Approve' })

  await approve.click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { blankReasonCalls?: number }).blankReasonCalls ?? 0)
    )
    .toBe(1)
  await expect(approve).not.toHaveAttribute('aria-disabled', 'true')
  await expect(card.locator('p[role="status"]')).toHaveCount(0)
})
