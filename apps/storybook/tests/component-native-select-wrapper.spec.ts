import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('native-select-wrapper'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Native select wrapper fixture</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

/** Wrapper, select and chevron boxes for the select with this accessible name. */
async function boxes(page: Page, name: string) {
  return page.getByRole('combobox', { name, exact: true }).evaluate((select) => {
    const wrapper = select.parentElement!
    const [wrapperBox, selectBox, iconBox] = [
      wrapper,
      select,
      wrapper.querySelector('[data-slot="native-select-icon"]')!,
    ].map((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    })
    return { wrapper: wrapperBox!, select: selectBox!, icon: iconBox! }
  })
}

test('wrapperClass sizes the wrapper and the select fills it', async ({ page }) => {
  const { wrapper, select, icon } = await boxes(page, 'Fixed')
  expect(wrapper.width).toBeCloseTo(256, 0)
  expect(select.width).toBeCloseTo(wrapper.width, 0)
  // The chevron stays inside the control's right edge instead of floating past it.
  expect(icon.right).toBeLessThanOrEqual(select.right)
  expect(icon.left).toBeGreaterThan(select.right - 40)
})

test('wrapperClass takes part in the parent flex layout', async ({ page }) => {
  const grows = await boxes(page, 'Grows')
  const capped = await boxes(page, 'Capped')
  expect(capped.wrapper.width).toBeLessThanOrEqual(128 + 0.5)
  expect(capped.select.width).toBeCloseTo(capped.wrapper.width, 0)
  // flex-1 takes the space the capped select leaves, and its select fills it.
  expect(grows.wrapper.width).toBeGreaterThan(capped.wrapper.width)
  expect(grows.select.width).toBeCloseTo(grows.wrapper.width, 0)
  expect(grows.icon.right).toBeLessThanOrEqual(grows.select.right)
})

test('without wrapperClass the control still shrink-wraps its select', async ({ page }) => {
  const { wrapper, select } = await boxes(page, 'Default')
  expect(select.width).toBeCloseTo(wrapper.width, 0)
  const container = await page
    .locator('[data-case="default"]')
    .evaluate((element) => element.getBoundingClientRect().width)
  // items-start leaves the wrapper at its content width, narrower than the column.
  expect(wrapper.width).toBeLessThan(container)
})
