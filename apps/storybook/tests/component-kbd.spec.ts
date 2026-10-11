import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let bundle: Awaited<ReturnType<typeof bundleFixture>>
test.beforeAll(async () => {
  bundle = await bundleFixture('kbd')
})
test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Keyboard hints</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: bundle.css })
  await page.addScriptTag({ content: bundle.script })
})

test('compact hints preserve the control name, keyboard chord, and default cap size', async ({
  page,
}) => {
  const control = page.getByRole('button', { name: 'Switch project', exact: true })
  await expect(control).toHaveAttribute('aria-keyshortcuts', 'Shift+Meta+P')
  await expect(control.locator('[data-slot="kbd-group"]')).toHaveAttribute('aria-hidden', 'true')
  await expect(control.locator('kbd')).toHaveText(['⇧', '⌘', 'P'])
  for (const key of await control.locator('kbd').all()) {
    expect((await key.boundingBox())?.height).toBe(16)
  }
  expect((await page.locator('p kbd').boundingBox())?.height).toBe(20)
  expect(
    await page.getByLabel('Command and Escape').evaluate((element) => getComputedStyle(element).gap)
  ).toBe('4px')
  expect(
    await control
      .locator('[data-slot="kbd-group"]')
      .evaluate((element) => getComputedStyle(element).gap)
  ).toBe('2px')
  await control.focus()
  await expect(control).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
