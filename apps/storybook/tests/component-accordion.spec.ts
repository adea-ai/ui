import { expect, test, type Locator } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('accordion'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Accordion</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

/**
 * The chevron's turn, in degrees, once its transition settles. Tailwind v4's
 * `rotate-*` sets the individual `rotate` property, not `transform`, so that is
 * the property to read.
 */
async function chevronTurn(trigger: Locator) {
  return trigger.locator('svg').evaluate(async (svg) => {
    // The icon transitions its transform; wait for it to land before measuring.
    await Promise.all(svg.getAnimations().map((animation) => animation.finished))
    const turn = getComputedStyle(svg).rotate
    return turn === 'none' ? 0 : Math.round(Number.parseFloat(turn))
  })
}

test('the chevron points down when closed and turns over when the section opens', async ({
  page,
}) => {
  const open = page.getByRole('button', { name: 'Open on mount' })
  const closed = page.getByRole('button', { name: 'Closed on mount' })

  await expect(open).toHaveAttribute('aria-expanded', 'true')
  await expect(closed).toHaveAttribute('aria-expanded', 'false')
  expect(await chevronTurn(open)).toBe(180)
  expect(await chevronTurn(closed)).toBe(0)

  await closed.click()
  await expect(closed).toHaveAttribute('aria-expanded', 'true')
  expect(await chevronTurn(closed)).toBe(180)

  await closed.click()
  await expect(closed).toHaveAttribute('aria-expanded', 'false')
  expect(await chevronTurn(closed)).toBe(0)
})

test('one trigger turning does not turn its sibling', async ({ page }) => {
  const open = page.getByRole('button', { name: 'Open on mount' })
  const closed = page.getByRole('button', { name: 'Closed on mount' })

  await open.click()
  await expect(open).toHaveAttribute('aria-expanded', 'false')
  expect(await chevronTurn(open)).toBe(0)
  expect(await chevronTurn(closed)).toBe(0)
})
