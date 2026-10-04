import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { buildLayoutBrowser, renderLayoutServer } from './layout-assets'
import { buildFloatingPreviewBrowser } from './floating-preview-assets'
let script: string
let css: string
let floatingScript: string
let floatingCss: string
test.beforeAll(async () => {
  ;({ script, css } = await buildLayoutBrowser())
  ;({ script: floatingScript, css: floatingCss } = await buildFloatingPreviewBrowser())
})
test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Layout</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

async function act(page: import('@playwright/test').Page, detail: string) {
  await page.evaluate(
    (value) => window.dispatchEvent(new CustomEvent('layout-fixture', { detail: value })),
    detail
  )
}
test('host header content, pane Tab stops and separator names remain independent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await act(page, 'host-presentation')
  const region = page.getByRole('region', { name: 'Host region host-a', exact: true })
  await expect(region.locator('[data-host-label]')).toHaveText('Host header host-a')
  await expect(region.locator('header [aria-hidden="true"]')).toHaveText('⌘')
  await expect(region).toHaveAttribute('tabindex', '0')
  const narrowHeader = page
    .getByRole('region', { name: 'Host region host-b', exact: true })
    .locator('header')
  await expect(narrowHeader.locator('[data-host-label]')).toContainText('long filename')
  expect(await narrowHeader.evaluate((header) => header.scrollWidth <= header.clientWidth)).toBe(
    true
  )
  await region.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'Host editor host-a', exact: true })).toBeFocused()
  const separator = page.getByRole('separator', { name: 'Resize workspace panes', exact: true })
  await separator.focus()
  await separator.press('ArrowRight')
  await expect(separator).toHaveAttribute('aria-valuenow', '55')
  await expect(page.getByRole('region', { name: 'Pane a', exact: true })).toHaveAttribute(
    'tabindex',
    '-1'
  )
})
test('mounting a persisted split under a hidden host preserves its ratios', async ({ page }) => {
  await act(page, 'split')
  await act(page, 'nested')
  await act(page, 'resize')
  await act(page, 'hide-unmount')
  await act(page, 'hidden-mount')
  await act(page, 'show')
  await expect(page.getByRole('separator', { name: 'Resize pane columns' })).toHaveAttribute(
    'aria-valuenow',
    '70'
  )
  await expect(page.getByRole('separator', { name: 'Resize pane rows' })).toHaveAttribute(
    'aria-valuenow',
    '50'
  )
})
test('hiding and showing nested panes preserves controlled split ratios', async ({ page }) => {
  await act(page, 'split')
  await act(page, 'nested')
  await act(page, 'resize')
  const columns = page.getByRole('separator', { name: 'Resize pane columns' })
  const rows = page.getByRole('separator', { name: 'Resize pane rows' })
  await expect(columns).toHaveAttribute('aria-valuenow', '70')
  await expect(rows).toHaveAttribute('aria-valuenow', '50')
  await act(page, 'hide')
  await expect(columns).toBeHidden()
  await act(page, 'show')
  await expect(columns).toBeVisible()
  await expect(columns).toHaveAttribute('aria-valuenow', '70')
  await expect(rows).toHaveAttribute('aria-valuenow', '50')
  await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('3')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
})
test('split, resize and cross-parent move preserve the editor owner, DOM, value and caret', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Editor a' })
  await field.fill('Unsent editor text')
  await field.focus()
  await field.evaluate((el) => {
    ;(el as HTMLTextAreaElement).setSelectionRange(3, 9, 'backward')
    el.setAttribute('data-retained', 'yes')
  })
  await act(page, 'split')
  await act(page, 'nested')
  await act(page, 'resize')
  await act(page, 'move')
  await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('3')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
  await expect(field).toHaveAttribute('data-retained', 'yes')
  await expect(field).toHaveValue('Unsent editor text')
  await expect(field).toBeFocused()
  expect(
    await field.evaluate((el) => [
      (el as HTMLTextAreaElement).selectionStart,
      (el as HTMLTextAreaElement).selectionEnd,
      (el as HTMLTextAreaElement).selectionDirection,
    ])
  ).toEqual([3, 9, 'backward'])
})
test('physical separator orientation, controls and constrained keyboard resizing agree', async ({
  page,
}) => {
  await act(page, 'split')
  await act(page, 'nested')
  const handles = page.getByRole('separator')
  await expect(handles).toHaveCount(2)
  const row = page.getByRole('separator', { name: 'Resize pane columns' })
  const column = page.getByRole('separator', { name: 'Resize pane rows' })
  await expect(row).toHaveAttribute('aria-orientation', 'vertical')
  await expect(column).toHaveAttribute('aria-orientation', 'horizontal')
  await row.focus()
  await row.press('ArrowRight')
  await expect(row).toHaveAttribute('aria-valuenow', '55')
  for (let i = 0; i < 15; i++) await row.press('ArrowRight')
  await expect(row).toHaveAttribute('aria-valuenow', '90')
  await expect(row).toHaveAttribute('aria-valuemin', '10')
  await expect(row).toHaveAttribute('aria-valuemax', '90')
  const ids = (await row.getAttribute('aria-controls'))!.split(' ')
  expect(ids.length).toBe(3)
  for (const id of ids) await expect(page.locator(`[id="${id}"]`)).toHaveAttribute('role', 'region')
  await column.focus()
  await column.press('ArrowDown')
  await expect(column).toHaveAttribute('aria-valuenow', '55')
})
test('keyboard closing focuses the host-selected survivor and removes only the closed owner', async ({
  page,
}) => {
  await act(page, 'split')
  const close = page.getByRole('button', { name: 'Close Pane b' })
  const geometry = await close.evaluate((element) => {
    const probe = document.createElement('div')
    probe.style.height = 'var(--control-height-xs)'
    element.append(probe)
    const expected = probe.getBoundingClientRect().height
    probe.remove()
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, expected }
  })
  expect(geometry.expected).toBeGreaterThan(16)
  expect(geometry.width).toBeCloseTo(geometry.expected, 1)
  expect(geometry.height).toBeCloseTo(geometry.expected, 1)
  await close.focus()
  // Establish keyboard modality before refocusing. macOS WebKit can skip
  // native buttons during Tab navigation when system Keyboard Navigation is off;
  // this probe checks the ring and keyboard activation, not that OS preference.
  await page.keyboard.press('Tab')
  await close.focus()
  await expect(close).toBeFocused()
  expect(await close.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
  await close.press('Enter')
  await expect(page.getByLabel('Unmounts')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Pane a' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Editor b' })).toHaveCount(0)
})

test('the leaf close action keeps its name and explains itself on hover', async ({ page }) => {
  await act(page, 'split')
  const close = page.getByRole('button', { name: 'Close Pane b', exact: true })
  await close.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Close Pane b.')
  // A layout without a close action renders none, so the tooltip cannot leak
  // into panes the host cannot dismiss.
  await expect(page.getByRole('button', { name: 'Close Other pane', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toHaveCount(1)
})

test('the pane drag affordance carries a native hover hint naming its pane', async ({ page }) => {
  await act(page, 'split')
  await act(page, 'host-presentation')
  const panes = page.getByRole('group', { name: 'Work panes', exact: true })
  await expect(panes.locator('[data-pane-id="a"] [data-pane-drag-handle]')).toHaveAttribute(
    'title',
    'Drag Pane a to move'
  )
  await expect(panes.locator('[data-pane-id="b"] [data-pane-drag-handle]')).toHaveAttribute(
    'title',
    'Drag Pane b to move'
  )
  // Without a move handler the header is not a drag affordance and stays hint-free.
  await expect(
    page
      .getByRole('group', { name: 'Host work panes', exact: true })
      .locator('[data-pane-drag-handle][title]')
  ).toHaveCount(0)
})

test('automated accessibility covers nested labelled panes in light and dark', async ({ page }) => {
  await act(page, 'split')
  await act(page, 'nested')
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    // Theme transitions expose intermediate colour pairings; audit the settled
    // theme, after the actual browser animations finish.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
    )
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
})
test('pointer resize changes physical pane geometry and keeps editors alive', async ({ page }) => {
  await act(page, 'split')
  const handle = page.getByRole('separator', { name: 'Resize pane columns' })
  const box = (await handle.boundingBox())!
  const pane = page.getByRole('region', { name: 'Pane a' })
  const before = (await pane.boundingBox())!.width
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  expect((await pane.boundingBox())!.width).toBeGreaterThan(before + 80)
  await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('2')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
})

test('a pane move never steals newer focus from another layout instance', async ({ page }) => {
  await act(page, 'split')
  await page.getByRole('textbox', { name: 'Editor a' }).focus()
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('layout-fixture', { detail: 'move' }))
    ;(document.querySelector('[aria-label="Other editor"]') as HTMLInputElement).focus()
  })
  await expect(page.getByRole('textbox', { name: 'Other editor' })).toBeFocused()
  const ids = await page
    .locator('[data-pane-id="a"]')
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(new Set(ids).size).toBe(2)
})
test('unmount cancels pending focus work and disposes every removed leaf owner', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await act(page, 'split')
  await page.getByRole('textbox', { name: 'Editor a' }).focus()
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('layout-fixture', { detail: 'move' }))
    window.dispatchEvent(new CustomEvent('layout-fixture', { detail: 'unmount' }))
    ;(document.querySelector('[aria-label="Other editor"]') as HTMLInputElement).focus()
  })
  await expect(page.getByLabel('Unmounts')).toHaveText('2')
  await expect(page.getByRole('textbox', { name: 'Other editor' })).toBeFocused()
  expect(errors).toEqual([])
})

test('floating preview pointer and keyboard controls stay within their host bounds', async ({
  page,
}) => {
  await page.evaluate(() => document.body.replaceChildren())
  await page.setViewportSize({ width: 800, height: 600 })
  await page.addStyleTag({ content: floatingCss })
  await page.addScriptTag({ content: floatingScript })
  const frame = page.getByRole('region', { name: 'Preview window', exact: true })
  const move = page.getByRole('button', { name: 'Move Preview window' })
  const startBox = (await move.boundingBox())!
  const box = (await frame.boundingBox())!
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    startBox.x + startBox.width / 2 - 50,
    startBox.y + startBox.height / 2 + 40,
    { steps: 3 }
  )
  await page.mouse.up()
  const moved = (await frame.boundingBox())!
  expect(moved.x).toBeLessThan(box.x - 35)
  await move.focus()
  await move.press('ArrowLeft')
  expect((await frame.boundingBox())!.x).toBe(moved.x - 10)
  const east = page.getByRole('button', { name: 'Resize Preview window east' })
  await east.focus()
  const before = (await frame.boundingBox())!.width
  await east.press('ArrowRight')
  expect((await frame.boundingBox())!.width).toBeGreaterThan(before)
  const handle = (await east.boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2, {
    steps: 3,
  })
  await page.mouse.up()
  expect((await frame.boundingBox())!.width).toBeGreaterThan(before + 20)
})

test('floating preview tracks source aspect changes and exposes keyboard scrolling', async ({
  page,
}) => {
  await page.evaluate(() => document.body.replaceChildren())
  await page.setViewportSize({ width: 800, height: 600 })
  await page.addStyleTag({ content: floatingCss })
  await page.addScriptTag({ content: floatingScript })
  const frame = page.getByRole('region', { name: 'Preview window', exact: true })
  const initial = (await frame.boundingBox())!
  await page.getByRole('button', { name: 'Change source ratio' }).click()
  await expect.poll(async () => (await frame.boundingBox())!.height).toBeGreaterThan(initial.height)

  const content = page.getByRole('region', { name: 'Preview window content' })
  await content.focus()
  await expect(content).toBeFocused()
  const initialScroll = await content.evaluate((node) => node.scrollTop)
  await content.press('PageDown')
  await expect.poll(() => content.evaluate((node) => node.scrollTop)).toBeGreaterThan(initialScroll)

  const close = page.getByRole('button', { name: 'Close Preview window' })
  await close.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Close Preview window.')
})

test('floating preview is bounded when narrow and has touch affordance, close, and accessible controls', async ({
  page,
}) => {
  await page.evaluate(() => document.body.replaceChildren())
  await page.setViewportSize({ width: 800, height: 600 })
  await page.addStyleTag({ content: floatingCss })
  await page.addScriptTag({ content: floatingScript })
  const frame = page.getByRole('region', { name: 'Preview window', exact: true })
  expect(
    await page
      .getByRole('button', { name: 'Move Preview window' })
      .evaluate((button) => getComputedStyle(button).touchAction)
  ).toBe('none')
  await page.setViewportSize({ width: 320, height: 240 })
  await expect.poll(async () => (await frame.boundingBox())!.width).toBeLessThanOrEqual(296)
  const box = (await frame.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    // Theme transitions expose intermediate colour pairings; audit the settled
    // theme, after the actual browser animations finish.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
    )
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
  await page.getByRole('button', { name: 'Close Preview window' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-closed', 'true')
})

test('floating preview close action remains operable from a touch pointer', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 800, height: 600 },
  })
  try {
    const page = await context.newPage()
    await page.setContent(
      '<!doctype html><html lang="en"><head><title>Touch preview</title></head><body><h1 class="sr-only">Touch fixture</h1></body></html>'
    )
    await page.addStyleTag({ content: floatingCss })
    await page.addScriptTag({ content: floatingScript })
    const close = page.getByRole('button', { name: 'Close Preview window' })
    const box = (await close.boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('body')).toHaveAttribute('data-closed', 'true')
  } finally {
    await context.close()
  }
})
test('fractional pane geometry survives CSP that blocks inline style attributes', async ({
  page,
}) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(message.text())
  })
  expect(script).not.toContain('</script')
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-layout-fixture'; style-src 'nonce-layout-fixture'; style-src-attr 'none'"><title>CSP layout</title><style nonce="layout-fixture">${css}</style></head><body><script nonce="layout-fixture">${script}</script></body></html>`
  )
  await act(page, 'split')
  const a = (await page.getByRole('region', { name: 'Pane a' }).boundingBox())!
  const b = (await page.getByRole('region', { name: 'Pane b' }).boundingBox())!
  expect(a.width).toBeGreaterThan(100)
  expect(Math.abs(a.width - b.width)).toBeLessThan(2)
  expect(b.x).toBeGreaterThan(a.x + 100)
  expect(violations).toEqual([])
})

test('required Solid source pipeline renders nested panes in native Node without browser globals', async () => {
  const markup = await renderLayoutServer()
  expect(markup).toContain('aria-label="Server panes"')
  expect(markup.match(/role="region"/g)).toHaveLength(2)
  expect(markup).toContain('aria-orientation="vertical"')
  expect(markup).toContain('aria-valuenow="50"')
})

for (const width of [320, 1440])
  for (const theme of ['light', 'dark']) {
    test(`eight pane geometry ${theme} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 800 })
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        theme === 'dark'
      )
      await act(page, 'split')
      await act(page, 'eight')
      const layout = page.getByRole('group', { name: 'Work panes', exact: true })
      await expect(layout.getByRole('region')).toHaveCount(8)
      await expect(layout.getByRole('separator')).toHaveCount(7)
      await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('8')
      await expect(page.getByLabel('Unmounts')).toHaveText('0')
      for (const pane of await layout.getByRole('region').all()) {
        const box = (await pane.boundingBox())!
        expect(box.width).toBeGreaterThan(50)
        expect(box.height).toBeGreaterThan(100)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      // Theme transitions expose intermediate colour pairings; audit the settled
      // theme, after the actual browser animations finish.
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
      )
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      await layout.screenshot({ path: testInfo.outputPath(`split-${theme}-${width}.png`) })
    })
  }

test('pane header pointer drag moves at the chosen edge without remounting editors', async ({
  page,
}) => {
  await act(page, 'split')
  const field = page.getByRole('textbox', { name: 'Editor a' })
  await field.fill('Retained through pointer move')
  const source = page
    .getByRole('group', { name: 'Work panes', exact: true })
    .locator('[data-pane-id="a"] [data-pane-drag-handle]')
  const target = page.getByRole('region', { name: 'Pane b' })
  const box = (await target.boundingBox())!
  await source.dragTo(target, { targetPosition: { x: box.width - 4, y: box.height / 2 } })
  await expect(page.getByLabel('Moves', { exact: true })).toHaveText('1')
  const panes = page.getByRole('group', { name: 'Work panes', exact: true }).getByRole('region')
  await expect(panes.first()).toHaveAttribute('data-pane-id', 'b')
  await expect(field).toHaveValue('Retained through pointer move')
  await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('2')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
  await expect(page.locator('[data-drop-direction]')).toHaveCount(0)
})

test('pane drag uses a bounded floating preview, grabbing cursor, and reduced-motion feedback', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await act(page, 'split')
  const feedback = await page.evaluate(() => {
    const root = document.querySelector('[aria-label="Work panes"]')!
    const source = root.querySelector('[data-pane-id="a"]') as HTMLElement
    const handle = source.querySelector('[data-pane-drag-handle]') as HTMLElement
    const frame = source.getBoundingClientRect()
    const dataTransfer = new DataTransfer()
    let dragImage: Element | undefined
    Object.defineProperty(dataTransfer, 'setDragImage', {
      configurable: true,
      value: (element: Element) => {
        dragImage = element
      },
    })
    handle.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer,
        clientX: frame.left + 16,
        clientY: frame.top + 16,
      })
    )
    const preview = document.querySelector('[data-split-drag-preview]') as HTMLElement
    const previewFrame = preview.getBoundingClientRect()
    const duringDrag = {
      rootDragging: root.hasAttribute('data-dragging'),
      cursor: getComputedStyle(handle).cursor,
      transitionDuration: Number.parseFloat(getComputedStyle(source).transitionDuration),
      previewWidth: previewFrame.width,
      previewHeight: previewFrame.height,
      previewPosition: getComputedStyle(preview).position,
      previewHasWindowFrame:
        preview.classList.contains('rounded-lg') &&
        preview.classList.contains('border') &&
        preview.classList.contains('shadow-xl'),
      dragImageUsesPreview: dragImage === preview,
      previewAriaHidden: preview.getAttribute('aria-hidden'),
      previewInert: preview.inert,
      previewHasText: preview.textContent?.includes('Pane a'),
      previewHasId: Boolean(preview.querySelector('[id]')),
      previewHasDraggable: Boolean(preview.querySelector('[draggable]')),
    }
    handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }))
    return {
      ...duringDrag,
      previewRemoved: !document.querySelector('[data-split-drag-preview]'),
      rootCleared: !root.hasAttribute('data-dragging'),
      cursorAfterDrag: getComputedStyle(handle).cursor,
    }
  })
  expect(feedback).toMatchObject({
    rootDragging: true,
    cursor: 'grabbing',
    previewWidth: 384,
    previewHeight: 256,
    previewPosition: 'fixed',
    previewHasWindowFrame: true,
    dragImageUsesPreview: true,
    previewAriaHidden: 'true',
    previewInert: true,
    previewHasText: true,
    previewHasId: false,
    previewHasDraggable: false,
    previewRemoved: true,
    rootCleared: true,
    cursorAfterDrag: 'grab',
  })
  expect(feedback.transitionDuration).toBeLessThanOrEqual(0.00001)
})

test('native pane drag snapshots canvas pixels without reconnecting embedded resources', async ({
  page,
}) => {
  const resourceRequests: string[] = []
  await page.route('https://drag-preview.invalid/**', async (route) => {
    resourceRequests.push(new URL(route.request().url()).pathname)
    await route.abort()
  })
  await act(page, 'split')
  await act(page, 'drag-preview-content')
  const layout = page.getByRole('group', { name: 'Work panes', exact: true })
  const source = layout.locator('[data-pane-id="a"] [data-pane-drag-handle]')
  await expect(source).toBeVisible()
  await expect.poll(() => resourceRequests.length).toBeGreaterThan(0)
  await page.waitForLoadState('networkidle')
  const requestsBeforeDrag = resourceRequests.length
  await page.evaluate(() => {
    const state = window as Window & { dragPreviewSvgLoads?: number }
    state.dragPreviewSvgLoads = 0
    document
      .querySelector('[data-pane-id="a"] [data-preview-svg]')
      ?.dispatchEvent(new Event('load'))
  })
  expect(
    await page.evaluate(
      () => (window as Window & { dragPreviewSvgLoads?: number }).dragPreviewSvgLoads
    )
  ).toBe(1)
  const bounds = (await source.boundingBox())!

  // Real pointer input triggers the browser's draggable path and native
  // DataTransfer, so this exercises setDragImage beyond a synthetic event.
  await page.mouse.move(bounds.x + 8, bounds.y + 8)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 40, bounds.y + 16, { steps: 5 })
  await expect(layout).toHaveAttribute('data-dragging', '')
  const preview = page.locator('[data-split-drag-preview]')
  await expect(preview).toHaveAttribute('data-native-drag-image', '')
  const svg = preview.locator('[data-preview-svg]')
  await expect(svg).toHaveCount(1)
  await expect(preview.locator('[onload]')).toHaveCount(0)
  await svg.evaluate((element) => element.dispatchEvent(new Event('load')))
  expect(
    await page.evaluate(
      () => (window as Window & { dragPreviewSvgLoads?: number }).dragPreviewSvgLoads
    )
  ).toBe(1)

  const snapshot = await preview.evaluate((element) => {
    const canvas = element.querySelector('canvas[data-preview-canvas]') as HTMLCanvasElement
    const pixel = canvas.getContext('2d')?.getImageData(0, 0, 1, 1).data
    return {
      inert: (element as HTMLElement).inert,
      ariaHidden: element.getAttribute('aria-hidden'),
      iframeCount: element.querySelectorAll('iframe').length,
      mediaCount: element.querySelectorAll('video, audio, object, embed').length,
      placeholders: Array.from(
        element.querySelectorAll('[data-split-drag-placeholder]'),
        (placeholder) => placeholder.getAttribute('data-split-drag-placeholder')
      ).toSorted(),
      canvasPixel: pixel ? Array.from(pixel) : [],
      canvasSize: canvas ? [canvas.width, canvas.height] : [],
    }
  })
  expect(snapshot).toMatchObject({
    inert: true,
    ariaHidden: 'true',
    iframeCount: 0,
    mediaCount: 0,
    placeholders: ['audio', 'embed', 'iframe', 'object', 'video'],
    canvasPixel: [18, 52, 86, 255],
    canvasSize: [384, 192],
  })

  await page.waitForTimeout(250)
  expect(resourceRequests).toHaveLength(requestsBeforeDrag)
  await page.mouse.up()
  await expect(preview).toHaveCount(0)
  await expect(layout).not.toHaveAttribute('data-dragging')
})

test('unmounting a layout during a pane drag removes the temporary preview', async ({ page }) => {
  await act(page, 'split')
  await page.evaluate(() => {
    const source = document.querySelector(
      '[aria-label="Work panes"] [data-pane-id="a"] [data-pane-drag-handle]'
    ) as HTMLElement
    const bounds = source.getBoundingClientRect()
    source.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer: new DataTransfer(),
        clientX: bounds.left + 8,
        clientY: bounds.top + 8,
      })
    )
  })
  await expect(page.locator('[aria-label="Work panes"]')).toHaveAttribute('data-dragging', '')
  await expect(page.locator('[data-split-drag-preview]')).toHaveCount(1)

  await act(page, 'unmount')
  await expect(page.locator('[aria-label="Work panes"]')).toHaveCount(0)
  await expect(page.locator('[data-split-drag-preview]')).toHaveCount(0)
  await expect(page.getByLabel('Unmounts', { exact: true })).toHaveText('2')
})

test('foreign layout and forged plaintext drops cannot invoke host moves', async ({ page }) => {
  await act(page, 'split')
  const source = page.locator('[data-pane-id="a"] [data-pane-drag-handle]').first()
  await source.dragTo(page.getByRole('region', { name: 'Other pane' }))
  await expect(page.getByLabel('Moves', { exact: true })).toHaveText('0')
  await page.getByRole('region', { name: 'Pane b' }).evaluate((target) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', 'a')
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }))
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }))
  })
  await expect(page.getByLabel('Moves', { exact: true })).toHaveText('0')
  await expect(page.locator('[data-drop-direction]')).toHaveCount(0)
})

test('injected pane actions give keyboard users the same host-owned move transition', async ({
  page,
}) => {
  await act(page, 'split')
  const field = page.getByRole('textbox', { name: 'Editor b' })
  await field.fill('Keyboard draft')
  const action = page.getByRole('button', { name: 'Move b before previous pane' })
  await action.focus()
  await action.press('Enter')
  await expect(
    page.getByRole('group', { name: 'Work panes', exact: true }).getByRole('region').first()
  ).toHaveAttribute('data-pane-id', 'b')
  await expect(field).toHaveValue('Keyboard draft')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
  await expect(action).toBeDisabled()
})

for (const cancel of ['dragend', 'close'] as const)
  test(`a ${cancel} clears drop feedback and invalidates the active drag payload`, async ({
    page,
  }) => {
    await act(page, 'split')
    await page.evaluate((reason) => {
      const root = document.querySelector('[aria-label="Work panes"]')!
      const source = root.querySelector('[data-pane-id="a"] [data-pane-drag-handle]')!
      const target = root.querySelector('[data-pane-id="b"]')!
      const box = target.getBoundingClientRect()
      const dataTransfer = new DataTransfer()
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      target.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          dataTransfer,
          clientX: box.right - 4,
          clientY: box.top + box.height / 2,
        })
      )
      if (
        target.getAttribute('data-drop-direction') !== 'row' ||
        target.getAttribute('data-drop-placement') !== 'after'
      )
        throw new Error('Missing edge-specific drop feedback')
      if (reason === 'dragend')
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }))
      else (root.querySelector('[aria-label="Close Pane a"]') as HTMLButtonElement).click()
      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          dataTransfer,
          clientX: box.right - 4,
          clientY: box.top + box.height / 2,
        })
      )
    }, cancel)
    await expect(page.getByLabel('Moves', { exact: true })).toHaveText('0')
    await expect(page.locator('[data-drop-direction]')).toHaveCount(0)
    await expect(
      page.getByRole('group', { name: 'Work panes', exact: true }).getByRole('status')
    ).toBeEmpty()
  })

test('automatic splits reflow into two rows of four without remounting pane content', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Editor a', exact: true })
  await field.fill('Retained while the grid reflows')
  await field.evaluate((element) => element.setAttribute('data-owner-proof', 'retained'))
  const panes = page
    .getByRole('group', { name: 'Work panes', exact: true })
    .locator('[data-pane-id]')
  for (let count = 2; count <= 8; count += 1) {
    await act(page, 'balanced')
    await expect(panes).toHaveCount(count)
    await expect(page.getByLabel('Mounts', { exact: true })).toHaveText(String(count))
    await expect(page.getByLabel('Unmounts', { exact: true })).toHaveText('0')
    await expect(field).toHaveAttribute('data-owner-proof', 'retained')
    await expect(field).toHaveValue('Retained while the grid reflows')
    const boxes = await panes.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      })
    )
    const rows = new Map<number, typeof boxes>()
    for (const box of boxes) {
      const key = Math.round(box.y)
      rows.set(key, [...(rows.get(key) ?? []), box])
    }
    expect([...rows.values()].map((row) => row.length)).toEqual(
      count === 2 ? [2] : [Math.ceil(count / 2), Math.floor(count / 2)]
    )
    for (const row of rows.values()) {
      expect(
        Math.max(...row.map((box) => box.width)) - Math.min(...row.map((box) => box.width))
      ).toBeLessThanOrEqual(2)
    }
  }
})
