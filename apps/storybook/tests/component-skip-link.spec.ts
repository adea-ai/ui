import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { buildSkipLinkBrowser } from './skip-link-assets'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await buildSkipLinkBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>App shell skip link</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('is the first visible keyboard stop and focuses the main target through its fragment', async ({
  page,
}) => {
  const link = page.getByRole('link', { name: 'Skip to main content', exact: true })
  await expect(link).toHaveAttribute('href', '#main-content')
  await expect(link).toHaveAttribute('tabindex', '0')

  const hiddenPosition = await link.evaluate((element) => element.getBoundingClientRect().y)
  expect(hiddenPosition).toBeLessThan(0)

  await page.keyboard.press('Tab')
  await expect(link).toBeFocused()
  await expect
    .poll(() => link.evaluate((element) => element.getBoundingClientRect().y))
    .toBeGreaterThanOrEqual(0)
  expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true)

  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }

  await link.press('Enter')
  await expect(page).toHaveURL(/#main-content$/)
  await expect(page.getByRole('main', { name: 'Main content' })).toBeFocused()
})

test('uses the supplied href, children, tabIndex, class and anchor attributes', async ({
  page,
}) => {
  const link = page.getByTestId('custom-skip-link')

  await expect(link).toHaveAttribute('href', '#secondary-content')
  await expect(link).toHaveAttribute('tabindex', '-1')
  await expect(link).toHaveAttribute('title', 'Jump to secondary content')
  await expect(link).toHaveClass(/w-fit/)
  await expect(link).toHaveText('Jump to secondary content')

  await link.evaluate((element: HTMLAnchorElement) => element.click())
  await expect(page).toHaveURL(/#secondary-content$/)
  await expect(page.getByRole('region', { name: 'Secondary content' })).toBeFocused()
})
