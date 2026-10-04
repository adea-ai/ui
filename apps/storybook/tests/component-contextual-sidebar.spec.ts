import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string

test.beforeAll(async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/contextual-sidebar.tsx'
        ),
        formats: ['iife'],
        name: 'ContextualSidebarFixture',
        cssFileName: 'contextual-sidebar-fixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

async function mountFixture(
  page: Page,
  options: { width: number; open: boolean; wideViewportAtLoad: boolean }
) {
  await page.setViewportSize({ width: options.width, height: 640 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Contextual sidebar</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.evaluate((fixtureOptions) => {
    const scopedWindow = window as Window & {
      contextualSidebarFixture?: { open?: boolean; wideViewportAtLoad?: boolean }
    }
    scopedWindow.contextualSidebarFixture = fixtureOptions
  }, options)
  await page.addScriptTag({ content: script })
}

test('desktop sizing and collapse stay aligned with the host grid and top-bar segment', async ({
  page,
}) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })

  const sidebar = page.locator('#fixture-contextual-sidebar-desktop')
  const ruler = page.getByRole('separator', { name: 'Resize workspace navigation' })
  await expect(sidebar).toHaveCSS('width', '272px')
  await expect(ruler).toHaveAttribute('aria-valuenow', '272')
  await expect(ruler).toHaveAttribute('aria-valuetext', '272 pixels')

  await ruler.focus()
  await page.keyboard.press('ArrowRight')
  await expect(ruler).toHaveAttribute('aria-valuenow', '288')
  await expect(page.getByLabel('Projected sidebar width')).toHaveText('288')
  await expect(page.getByLabel('Committed sidebar width')).toHaveText('288')
  await expect(sidebar).toHaveCSS('width', '288px')

  await page.keyboard.press('Home')
  await expect(ruler).toHaveAttribute('aria-valuenow', '208')
  await page.keyboard.press('ArrowLeft')
  await expect(ruler).toHaveAttribute('aria-valuenow', '208')
  await page.keyboard.press('End')
  await expect(ruler).toHaveAttribute('aria-valuenow', '448')
  await page.keyboard.press('ArrowRight')
  await expect(ruler).toHaveAttribute('aria-valuenow', '448')

  const projectedWidths = await page.evaluate(() => {
    const sidebarColumn = document.querySelector('#sidebar-column')!.getBoundingClientRect()
    const topbarSegment = document.querySelector('#sidebar-topbar-segment')!.getBoundingClientRect()
    const main = document.querySelector('.workspace-sidebar-fixture-main')!.getBoundingClientRect()
    return {
      sidebar: sidebarColumn.width,
      topbar: topbarSegment.width,
      mainStart: main.left,
      divider: topbarSegment.right,
    }
  })
  expect(Math.abs(projectedWidths.sidebar - projectedWidths.topbar)).toBeLessThan(1)
  expect(Math.abs(projectedWidths.mainStart - projectedWidths.divider)).toBeLessThan(1)

  await page.getByRole('button', { name: 'Toggle workspace navigation' }).click()
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true')
  expect(await sidebar.evaluate((element) => (element as HTMLElement).inert)).toBe(true)
  const collapsedWidths = await page.evaluate(() => ({
    sidebar: document.querySelector('#sidebar-column')!.getBoundingClientRect().width,
    topbar: document.querySelector('#sidebar-topbar-segment')!.getBoundingClientRect().width,
    mainStart: document.querySelector('.workspace-sidebar-fixture-main')!.getBoundingClientRect()
      .left,
  }))
  expect(collapsedWidths.sidebar).toBe(0)
  expect(collapsedWidths.topbar).toBe(0)
  expect(collapsedWidths.mainStart).toBe(0)
  await page.getByRole('button', { name: 'Toggle workspace navigation' }).click()
  await expect(sidebar).not.toHaveAttribute('aria-hidden', 'true')
  await expect(sidebar).toHaveCSS('width', '448px')
})

test('mobile navigation contains nested menus and restores focus', async ({ page }) => {
  await mountFixture(page, { width: 320, open: false, wideViewportAtLoad: false })
  const opener = page.getByRole('button', { name: 'Toggle workspace navigation' })
  await opener.click()

  const dialog = page.getByRole('dialog', { name: 'Workspace navigation' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('#fixture-contextual-sidebar-mobile')).toBeVisible()
  await expect(dialog.getByRole('separator')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Project actions' }).click()
  const menu = dialog.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Rename project' })).toBeVisible()
  expect(await menu.evaluate((element) => element.closest('[role="dialog"]') !== null)).toBe(true)
  await menu.getByRole('menuitem', { name: 'Rename project' }).click()
  await expect(dialog.locator('[role="menu"]')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('a wide-loaded open seed does not pop the mobile sheet after a narrow remount', async ({
  page,
}) => {
  await mountFixture(page, { width: 320, open: true, wideViewportAtLoad: true })
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Toggle workspace navigation' })).toBeVisible()
})

test('a live desktop-to-mobile resize closes the expanded desktop navigation before the Sheet opens', async ({
  page,
}) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })
  await expect(page.locator('#fixture-contextual-sidebar-desktop')).toBeVisible()

  await page.setViewportSize({ width: 320, height: 640 })

  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Toggle workspace navigation' })).toBeVisible()
})

test('a narrow boot preserves its open navigation intent', async ({ page }) => {
  await mountFixture(page, { width: 320, open: true, wideViewportAtLoad: false })
  const opener = page.getByRole('button', { name: 'Toggle workspace navigation' })
  const dialog = page.getByRole('dialog', { name: 'Workspace navigation' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('separator')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('the right-edge ruler reports pane width and keeps keyboard movement on its visual edge', async ({
  page,
}) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })

  const host = page.locator('#right-ruler-host')
  const handle = page.getByRole('separator', { name: 'Resize right utility' })
  await expect(handle).toHaveAttribute('aria-valuenow', '272')
  const initial = await Promise.all([host.boundingBox(), handle.boundingBox()])
  expect(initial[0]).not.toBeNull()
  expect(initial[1]).not.toBeNull()
  expect(Math.abs(initial[1]!.x - initial[0]!.x)).toBeLessThan(2)

  await handle.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(handle).toHaveAttribute('aria-valuenow', '288')
  await expect(page.getByLabel('Right utility width')).toHaveText('288')

  const afterArrow = await handle.boundingBox()
  const afterArrowHost = await host.boundingBox()
  expect(afterArrow).not.toBeNull()
  expect(Math.abs(afterArrow!.x - afterArrowHost!.x)).toBeLessThan(2)

  await page.keyboard.press('Home')
  await expect(handle).toHaveAttribute('aria-valuenow', '208')
  const atMinimum = await handle.boundingBox()
  const minimumHost = await host.boundingBox()
  expect(atMinimum).not.toBeNull()
  expect(Math.abs(atMinimum!.x - minimumHost!.x)).toBeLessThan(2)

  await page.keyboard.press('End')
  await expect(handle).toHaveAttribute('aria-valuenow', '448')
  const atMaximum = await handle.boundingBox()
  const maximumHost = await host.boundingBox()
  expect(atMaximum).not.toBeNull()
  expect(Math.abs(atMaximum!.x - maximumHost!.x)).toBeLessThan(2)
})

test('the right-edge ruler commits one pointer drag using the pane-width value', async ({
  page,
}) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })

  const handle = page.getByRole('separator', { name: 'Resize right utility' })
  await expect(handle).toHaveAttribute('aria-valuenow', '272')

  const bounds = await handle.boundingBox()
  expect(bounds).not.toBeNull()
  const x = bounds!.x + bounds!.width / 2
  const y = bounds!.y + bounds!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await expect(handle).toHaveAttribute('aria-valuenow', '272')
  await page.mouse.move(x - 40, y, { steps: 4 })
  await page.mouse.up()

  await expect(page.getByLabel('Right utility width')).toHaveText('312')
  await expect(page.getByLabel('Right utility commit count')).toHaveText('1')
  await expect(page.getByLabel('Right utility committed width')).toHaveText('312')
})

test('canceling a pointer resize preserves width when navigation closes and reopens', async ({
  page,
}) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })
  const handle = page.getByRole('separator', { name: 'Resize workspace navigation' })
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2)
  await expect(handle).toHaveAttribute('aria-valuenow', '312')
  await handle.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  // Native cancellation does not guarantee a later pointerup. End feedback and
  // restore keyboard operation before releasing Playwright's mouse button.
  await expect(handle).not.toHaveAttribute('data-dragging', '')
  await expect(page.getByLabel('Committed sidebar width')).toHaveText('272')
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '328')
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2)
  await expect(handle).toHaveAttribute('aria-valuenow', '328')
  await page.mouse.up()
  await expect(page.getByLabel('Committed sidebar width')).toHaveText('328')
  const opener = page.getByRole('button', { name: 'Toggle workspace navigation' })
  await opener.click()
  await opener.click()
  await expect(page.locator('#fixture-contextual-sidebar-desktop')).toHaveCSS('width', '328px')
  const freshBox = (await handle.boundingBox())!
  const x = freshBox.x + freshBox.width / 2
  const y = freshBox.y + freshBox.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 16, y)
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-valuenow', '344')
  await expect(page.getByLabel('Committed sidebar width')).toHaveText('344')
})

for (const finish of ['blur', 'unmount'] as const) {
  test(`keyboard resize persists when ${finish} happens before keyup`, async ({ page }) => {
    await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })
    const handle = page.getByRole('separator', { name: 'Resize workspace navigation' })
    const opener = page.getByRole('button', { name: 'Toggle workspace navigation' })
    await handle.focus()
    await page.keyboard.down('ArrowRight')
    await expect(handle).toHaveAttribute('aria-valuenow', '288')
    if (finish === 'blur') await opener.focus()
    else
      await opener.evaluate((element) => {
        if (!(element instanceof HTMLButtonElement))
          throw new Error('Expected shared Button opener')
        element.click()
      })
    await expect(page.getByLabel('Committed sidebar width')).toHaveText('288')
    await page.keyboard.up('ArrowRight')
    if (finish === 'unmount') await opener.click()
    await expect(page.locator('#fixture-contextual-sidebar-desktop')).toHaveCSS('width', '288px')
  })
}

test('lost pointer capture stops resizing and restores keyboard control without pointerup', async ({
  page,
}) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })
  const handle = page.getByRole('separator', { name: 'Resize workspace navigation' })
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 24, y)
  await expect(handle).toHaveAttribute('aria-valuenow', '296')
  expect(
    await handle.evaluate((element) => {
      element.releasePointerCapture(1)
      return element.hasPointerCapture(1)
    })
  ).toBe(false)
  // Engines may process the pending lost-capture event on the next pointer event.
  await page.mouse.move(x + 64, y)
  await expect(handle).not.toHaveAttribute('data-dragging', '')
  await expect(handle).toHaveAttribute('aria-valuenow', '296')
  await expect(page.getByLabel('Committed sidebar width')).toHaveText('272')
  await page.keyboard.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '312')
  await page.mouse.up()
  await expect(page.getByLabel('Committed sidebar width')).toHaveText('312')
})

test('captured pointer movement clamps to pane bounds outside the ruler', async ({ page }) => {
  await mountFixture(page, { width: 800, open: true, wideViewportAtLoad: false })
  const handle = page.getByRole('separator', { name: 'Resize right utility' })
  const box = (await handle.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(50, y)
  await expect(handle).toHaveAttribute('aria-valuenow', '448')
  await page.mouse.move(790, y)
  await expect(handle).toHaveAttribute('aria-valuenow', '208')
  await page.mouse.up()
  await expect(page.getByLabel('Right utility commit count')).toHaveText('1')
  await expect(page.getByLabel('Right utility committed width')).toHaveText('208')
})

for (const width of [800, 320]) {
  test(`sidebar accessibility and rendered geometry at ${width}px`, async ({ page }, testInfo) => {
    await mountFixture(page, { width, open: true, wideViewportAtLoad: false })
    if (width === 320) {
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      // Measure the finished palette, not an intermediate scrim/fade frame.
      await expect
        .poll(() =>
          dialog.evaluate(
            (element) =>
              element
                .getAnimations({ subtree: true })
                .filter((animation) => animation.playState === 'running').length
          )
        )
        .toBe(0)
    }
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('sidebar.png'), fullPage: true })
  })
}
