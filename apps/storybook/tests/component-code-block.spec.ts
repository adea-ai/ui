import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('code-block'))
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Code block</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

const body = (page: Page, id: string) => page.locator(`#${id} [data-slot="code-block-body"]`)

test('maxHeight caps the body and scrolls it; the default still grows', async ({ page }) => {
  const metrics = (id: string) =>
    body(page, id).evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))

  const grown = await metrics('default-block')
  expect(grown.height).toBeGreaterThan(600)
  expect(grown.scrollHeight).toBeLessThanOrEqual(Math.ceil(grown.height))

  const px = await metrics('capped-px')
  expect(px.height).toBeCloseTo(200, 0)
  expect(px.overflowY).toBe('auto')
  expect(px.scrollHeight).toBeGreaterThan(px.height)

  const rootFontSize = await page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  )
  const length = await metrics('capped-length')
  expect(length.height).toBeCloseTo(10 * rootFontSize, 0)

  // The capped region stays a named tab stop and scrolls from the keyboard.
  const region = page.getByRole('region', { name: 'ts code' }).nth(1)
  await expect(region).toHaveAttribute('tabindex', '0')
  await region.focus()
  await page.keyboard.press('End')
  await expect.poll(() => body(page, 'capped-px').evaluate((e) => e.scrollTop)).toBeGreaterThan(0)

  // Under its threshold, a capped block does not repeat its action row.
  await expect(page.locator('#capped-px [data-code-block-footer]')).toHaveCount(0)
  await expect(page.locator('#default-block [data-code-block-footer]')).toHaveCount(1)
})

test('wrap soft-wraps long lines instead of scrolling sideways', async ({ page }) => {
  const sideways = (id: string) =>
    body(page, id).evaluate((element) => element.scrollWidth - element.clientWidth)

  expect(await sideways('unwrapped')).toBeGreaterThan(0)
  await expect(body(page, 'unwrapped')).not.toHaveAttribute('data-wrap')
  for (const id of ['wrapped', 'wrapped-numbered', 'wrapped-highlight']) {
    expect(await sideways(id), id).toBeLessThanOrEqual(0)
    await expect(body(page, id)).toHaveAttribute('data-wrap', '')
  }
  // Wrapping is visual only: the copied and rendered text is unchanged.
  await expect(page.locator('#wrapped pre')).toHaveText(
    await page.locator('#unwrapped pre').innerText()
  )
  const wrappedHeight = await body(page, 'wrapped').evaluate((e) => e.clientHeight)
  const unwrappedHeight = await body(page, 'unwrapped').evaluate((e) => e.clientHeight)
  expect(wrappedHeight).toBeGreaterThan(unwrappedHeight)
})
