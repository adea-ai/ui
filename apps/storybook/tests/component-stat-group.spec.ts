import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('stat-group'))
})

test.beforeEach(async ({ page }) => {
  // A wide window: the default group's `lg` breakpoint is satisfied here, so any
  // column count that varies with the container is the container's doing.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Stat group</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

async function layout(page: Page, id: string) {
  return page.locator(`#${id} [data-slot="stat"]`).evaluateAll((tiles) => {
    const boxes = tiles.map((tile) => tile.getBoundingClientRect())
    const group = tiles[0]!.parentElement!.getBoundingClientRect()
    return {
      columns: new Set(boxes.map((box) => Math.round(box.left))).size,
      minWidth: Math.min(...boxes.map((box) => box.width)),
      contained: boxes.every((box) => box.left >= group.left - 1 && box.right <= group.right + 1),
      // Tiles in a row share the remainder: the first row spans the group.
      firstRowSpan:
        Math.max(...boxes.filter((box) => box.top === boxes[0]!.top).map((box) => box.right)) -
        boxes[0]!.left,
      groupWidth: group.width,
    }
  })
}

test('fit sizes the column count from the group, not the viewport', async ({ page }) => {
  const narrow = await layout(page, 'narrow-fit')
  const wide = await layout(page, 'wide-fit')

  // 320px holds two 150px tiles and a 12px gap; 704px holds four.
  expect(narrow.columns, JSON.stringify(narrow)).toBe(2)
  expect(wide.columns, JSON.stringify(wide)).toBe(4)
  for (const measured of [narrow, wide]) {
    expect(measured.minWidth, JSON.stringify(measured)).toBeGreaterThanOrEqual(149)
    expect(measured.contained, JSON.stringify(measured)).toBe(true)
    // The tiles grow to fill the row rather than leaving a ragged right edge.
    expect(measured.firstRowSpan).toBeCloseTo(measured.groupWidth, 0)
  }
})

test('the default group still steps by viewport breakpoint', async ({ page }) => {
  // At a 1280px window the `lg` rung asks for four columns whatever the container,
  // which is exactly why a pane-width group needs `fit`.
  const narrow = await layout(page, 'narrow-default')
  const wide = await layout(page, 'wide-default')
  expect(narrow.columns, JSON.stringify(narrow)).toBe(4)
  expect(wide.columns, JSON.stringify(wide)).toBe(4)
  expect(narrow.minWidth).toBeLessThan(150)
})
