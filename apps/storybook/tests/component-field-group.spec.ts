import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('field-group'))
})

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Field group fixture</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
}

/** Left edge and width of each field in a group, plus the group's own width. */
async function layout(page: Page, columns: string) {
  return page.locator(`[data-slot="field-group"][data-columns="${columns}"]`).evaluate((group) => {
    const box = group.getBoundingClientRect()
    return {
      group: box.width,
      fields: Array.from(group.children, (child) => {
        const rect = child.getBoundingClientRect()
        return { left: Math.round(rect.left), top: Math.round(rect.top), width: rect.width }
      }),
    }
  })
}

test('columns=3 lays three fields on one row from the sm breakpoint', async ({ page }) => {
  await open(page, 900)
  const { group, fields } = await layout(page, '3')
  const [first, second, third, wide] = fields
  expect(new Set([first!.top, second!.top, third!.top]).size).toBe(1)
  expect(first!.left).toBeLessThan(second!.left)
  expect(second!.left).toBeLessThan(third!.left)
  expect(Math.abs(first!.width - second!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(second!.width - third!.width)).toBeLessThanOrEqual(1)
  // `col-span-full` still spans every column on its own row.
  expect(wide!.top).toBeGreaterThan(first!.top)
  expect(Math.abs(wide!.width - group)).toBeLessThanOrEqual(1)
})

test('columns=3 stacks to one column below the sm breakpoint', async ({ page }) => {
  await open(page, 480)
  const { fields } = await layout(page, '3')
  expect(new Set(fields.map((field) => field.left)).size).toBe(1)
  const tops = fields.map((field) => field.top)
  expect(tops).toEqual(tops.toSorted((a, b) => a - b))
  expect(new Set(tops).size).toBe(fields.length)
})

test('columns 2 and the default keep their layouts', async ({ page }) => {
  await open(page, 900)
  const two = await layout(page, '2')
  expect(new Set(two.fields.slice(0, 2).map((field) => field.top)).size).toBe(1)
  expect(two.fields[2]!.top).toBeGreaterThan(two.fields[0]!.top)
  const stacked = await layout(page, 'default')
  expect(new Set(stacked.fields.map((field) => field.left)).size).toBe(1)
  expect(new Set(stacked.fields.map((field) => field.top)).size).toBe(stacked.fields.length)
})
