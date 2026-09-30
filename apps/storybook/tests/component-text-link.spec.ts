import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { buildTextLinkBrowser } from './text-link-assets'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await buildTextLinkBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>TextLink test</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('is keyboard focusable, shows a focus indicator and follows its fragment', async ({
  page,
}) => {
  const link = page.getByRole('link', { name: 'accessibility guide', exact: false }).first()
  await expect(link).toHaveAttribute('href', '#link-destination')
  await expect(link).toHaveAttribute('tabindex', '0')

  await page.keyboard.press('Tab')
  await expect(link).toBeFocused()
  expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  expect(await link.evaluate((element) => getComputedStyle(element).boxShadow !== 'none')).toBe(
    true
  )

  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }

  await link.press('Enter')
  await expect(page).toHaveURL(/#link-destination$/)
  await expect(page.getByRole('region', { name: 'Accessibility guide' })).toBeFocused()
})

test('preserves external navigation safety attributes, class and caller event handlers', async ({
  page,
}) => {
  const external = page.getByTestId('external-link')
  await expect(external).toHaveAttribute('href', 'https://example.test/docs?from=text-link')
  await expect(external).toHaveAttribute('target', '_blank')
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(external).toHaveAttribute('title', 'Open external documentation')

  const eventLink = page.getByTestId('event-link')
  await expect(eventLink).toHaveAttribute('tabindex', '0')
  await expect(eventLink).toHaveClass(/w-fit/)
  await eventLink.click()
  await expect(page.getByTestId('click-state')).toHaveText('clicked')
  await expect(page).not.toHaveURL(/prevented-navigation/)
})
