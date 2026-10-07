import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('item'))
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Item</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!

test('descriptions clamp to two lines unless clamp is false', async ({ page }) => {
  const lines = (id: string) =>
    page.locator(`#${id} [data-slot="item-description"]`).evaluate((element) => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
      return {
        lines: Math.round(element.getBoundingClientRect().height / lineHeight),
        clipped: element.scrollHeight > element.clientHeight + 1,
      }
    })
  expect(await lines('clamped')).toEqual({ lines: 2, clipped: true })
  const unclamped = await lines('unclamped')
  expect(unclamped.lines).toBeGreaterThan(2)
  expect(unclamped.clipped).toBe(false)
})

test('stackTrailing moves the trailing slot under the body below 28rem', async ({ page }) => {
  const layout = async (id: string) => {
    const body = await box(page, `#${id} [data-slot="item-body"]`)
    const trailing = await box(page, `#${id} [data-slot="item-trailing"]`)
    const item = await box(page, `#${id}`)
    return { body, trailing, item }
  }

  // Default: the trailing slot stays beside the body, which it squeezes.
  const squeezed = await layout('narrow-default')
  expect(squeezed.trailing.y).toBeLessThan(squeezed.body.y + squeezed.body.height)
  expect(squeezed.trailing.x).toBeGreaterThan(squeezed.body.x)

  // Opted in and narrow: one line for the body, the actions end-aligned below it.
  const stacked = await layout('narrow-stacked')
  expect(stacked.trailing.y).toBeGreaterThanOrEqual(stacked.body.y + stacked.body.height - 1)
  expect(stacked.body.width).toBeGreaterThan(squeezed.body.width)
  const removeButton = await box(page, '#narrow-stacked [aria-label="Remove stacked"]')
  const padding = await page
    .locator('#narrow-stacked')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingRight))
  expect(
    Math.abs(removeButton.x + removeButton.width - (stacked.item.x + stacked.item.width - padding))
  ).toBeLessThanOrEqual(1)

  // Opted in but wide: still one row.
  const wide = await layout('wide-stacked')
  expect(wide.trailing.y).toBeLessThan(wide.body.y + wide.body.height)
  expect(wide.trailing.x).toBeGreaterThan(wide.body.x + wide.body.width - 1)
})
