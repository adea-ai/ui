import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

/**
 * Focus the Tree has asked for but not yet given (a recovery queued after a row was
 * removed, or a keyboard move to a row a virtualised host has not mounted yet) is a
 * request, not a claim. A control outside the tree that takes focus in the meantime
 * keeps it: the request is withdrawn when focus leaves, and ownership is checked
 * again when a row finally mounts. Focus that fell to the body, with nothing taking
 * it, still recovers into the tree.
 */
declare global {
  interface Window {
    delayedTree: { mount: (start: number) => void; reveals: string[] }
  }
}

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('tree-delayed-mount'))
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Tree delayed focus</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

const row = (page: Page, id: string) => page.locator(`#delayed-tree [data-tree-id="${id}"]`)
const mount = (page: Page, start: number) =>
  page.evaluate((next) => window.delayedTree.mount(next), start)
const owner = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return 'BODY'
    return active.getAttribute('data-tree-id') ?? (active.id || active.tagName)
  })
/** Let every queued microtask and the next task run, so a late focus move would have happened. */
const settle = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => setTimeout(done, 50)))

test('a recovery waiting for its row lands when nothing took focus (body recovery)', async ({
  page,
}) => {
  await row(page, 'file-1').focus()
  // The host unmounts the focused row. Focus falls to the body; `Tree` asks for the
  // row it will mount again.
  await mount(page, 20)
  await settle(page)
  expect(await owner(page)).toBe('BODY')

  await mount(page, 0)
  await expect(row(page, 'file-1')).toBeFocused()
})

test('an outside control that takes focus after recovery is queued keeps it when the row mounts', async ({
  page,
}) => {
  await row(page, 'file-1').focus()
  await mount(page, 20)
  await settle(page)

  await page.locator('#outside').focus()
  await mount(page, 0)
  await settle(page)

  expect(await owner(page)).toBe('outside')
  // Only the roving stop belongs to the tree; it is still file-1 and still reachable.
  await expect(row(page, 'file-1')).toHaveAttribute('tabindex', '0')
})

test('the same when the control is reached by a pointer press', async ({ page }) => {
  await row(page, 'file-1').focus()
  await mount(page, 20)
  await settle(page)

  await page.locator('#outside').click()
  await mount(page, 0)
  await settle(page)

  expect(await owner(page)).toBe('outside')
})

test('focus that went to an outside control and then to nothing is not recovered either', async ({
  page,
}) => {
  await row(page, 'file-1').focus()
  await mount(page, 20)
  await settle(page)

  await page.locator('#outside').focus()
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  expect(await owner(page)).toBe('BODY')
  await mount(page, 0)
  await settle(page)

  expect(await owner(page)).toBe('BODY')
})

test('leaving the tree by keyboard withdraws a move to a row that has not mounted', async ({
  page,
}) => {
  await row(page, 'file-0').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(row(page, 'file-3')).toBeFocused()
  // file-4 is not mounted, so this move waits for it; focus stays on file-3.
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => page.evaluate(() => window.delayedTree.reveals.at(-1))).toBe('file-4')
  expect(await owner(page)).toBe('file-3')

  await page.keyboard.press('Shift+Tab')
  expect(await owner(page)).toBe('outside')

  await mount(page, 2)
  await settle(page)
  expect(await owner(page)).toBe('outside')
})

test('a keyboard move to a row that mounts later still lands while focus stays in the tree', async ({
  page,
}) => {
  await row(page, 'file-0').focus()
  for (let step = 0; step < 4; step += 1) await page.keyboard.press('ArrowDown')
  await expect.poll(() => page.evaluate(() => window.delayedTree.reveals.at(-1))).toBe('file-4')

  await mount(page, 2)
  await expect(row(page, 'file-4')).toBeFocused()
})

test('focus given to a control outside in the same turn as the row is removed is not reclaimed', async ({
  page,
}) => {
  await row(page, 'file-1').focus()
  // Remove the focused row and hand focus away before any microtask has run.
  await page.evaluate(() => {
    window.delayedTree.mount(20)
    document.getElementById('outside')!.focus()
  })
  await mount(page, 0)
  await settle(page)

  expect(await owner(page)).toBe('outside')
})
