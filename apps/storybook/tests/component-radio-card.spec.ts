import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('radio-card'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Radio card fixture</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

/** Vertical centres, relative to the item, of the radio control, media and text. */
async function centres(item: import('@playwright/test').Locator) {
  return item.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const mid = (target: Element | null) => {
      if (!target) return null
      const rect = target.getBoundingClientRect()
      return rect.top + rect.height / 2 - (box.top + box.height / 2)
    }
    return {
      radio: mid(element.querySelector('input + *')),
      media: mid(element.querySelector('[data-slot="radio-group-item-media"]')),
      text: mid(element.lastElementChild),
    }
  })
}

test('a card centres its radio, media and text on the card axis', async ({ page }) => {
  for (const name of ['Label only', 'With description']) {
    const card = page
      .getByRole('radiogroup', { name, exact: true })
      .locator('[data-slot="radio-group-item"]')
      .first()
    const { radio, media, text } = await centres(card)
    expect(Math.abs(radio ?? 99), `${name}: radio`).toBeLessThanOrEqual(1)
    expect(Math.abs(media ?? 99), `${name}: media`).toBeLessThanOrEqual(1)
    expect(Math.abs(text ?? 99), `${name}: text`).toBeLessThanOrEqual(1)
  }
})

test('a card with no media still centres its radio against the label', async ({ page }) => {
  const card = page
    .getByRole('radiogroup', { name: 'Label only', exact: true })
    .locator('[data-slot="radio-group-item"]')
    .nth(1)
  const { radio, text } = await centres(card)
  expect(Math.abs(radio ?? 99)).toBeLessThanOrEqual(1)
  expect(Math.abs(text ?? 99)).toBeLessThanOrEqual(1)
})

test('a bare row keeps its radio on the first line of the label', async ({ page }) => {
  const row = page
    .getByRole('radiogroup', { name: 'Bare rows', exact: true })
    .locator('[data-slot="radio-group-item"]')
  const { radio } = await centres(row)
  // The text block is two lines tall, so a top-aligned radio sits above centre.
  expect(radio).toBeLessThan(-4)
})
