import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { buildLayoutBrowser, renderLayoutServer } from './layout-assets'
let script: string
let css: string
test.beforeAll(async () => {
  ;({ script, css } = await buildLayoutBrowser())
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
test('closing focuses the host-selected survivor and removes only the closed owner', async ({
  page,
}) => {
  await act(page, 'split')
  await page.getByRole('button', { name: 'Close Pane b' }).click()
  await expect(page.getByLabel('Unmounts')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Pane a' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Editor b' })).toHaveCount(0)
})

test('automated accessibility covers nested labelled panes in light and dark', async ({ page }) => {
  await act(page, 'split')
  await act(page, 'nested')
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
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
