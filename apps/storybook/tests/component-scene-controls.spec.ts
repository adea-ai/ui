import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

declare global {
  interface Window {
    sceneControlsFixture?: {
      unmount: () => void
      replaceMovementCallback: () => void
      disableMovement: () => void
      setLocalizedLabels: () => void
    }
    sceneControlsPointerId?: number
    sceneControlsPointerEvents?: string[]
  }
}

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
          '../../../packages/ui/tests/fixtures/scene-controls.tsx'
        ),
        formats: ['iife'],
        name: 'SceneControlsFixture',
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

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Scene controls</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('keeps touch controls at least 48px in compact density and names every action', async ({
  page,
}) => {
  await page.locator('html').evaluate((element) => element.setAttribute('data-density', 'compact'))
  const forward = page.getByRole('button', { name: 'Move forward' })
  const box = await forward.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(48)
  expect(box?.height).toBeGreaterThanOrEqual(48)
  await expect(page.getByRole('group', { name: 'Scene movement controls' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Camera zoom' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('fits a narrow viewport at 200% root font size and preserves every touch target', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  const groups = [
    page.getByRole('group', { name: 'Scene movement controls' }),
    page.getByRole('group', { name: 'Camera zoom' }),
  ]
  for (const group of groups) {
    const box = await group.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(320)
    expect(box!.height).toBeGreaterThanOrEqual(96)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(640)
  }

  const controls = [
    ...(await groups[0]!.getByRole('button').all()),
    ...(await groups[1]!.getByRole('button').all()),
    page.getByRole('button', { name: 'Jump' }),
  ]
  for (const control of controls) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(96)
    expect(box!.height).toBeGreaterThanOrEqual(96)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(640)
    const icon = await control.locator('svg').boundingBox()
    expect(icon).not.toBeNull()
    expect(icon!.width).toBeGreaterThanOrEqual(24)
    expect(icon!.height).toBeGreaterThanOrEqual(24)
    expect(icon!.x).toBeGreaterThanOrEqual(box!.x)
    expect(icon!.y).toBeGreaterThanOrEqual(box!.y)
    expect(icon!.x + icon!.width).toBeLessThanOrEqual(box!.x + box!.width)
    expect(icon!.y + icon!.height).toBeLessThanOrEqual(box!.y + box!.height)
  }

  const forward = page.getByRole('button', { name: 'Move forward' })
  await forward.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveText('Hold to move forward')
  const tooltipBox = await tooltip.boundingBox()
  expect(tooltipBox).not.toBeNull()
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(0)
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(320)

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(320)
})

test('hold tooltips explain the gesture and retain localized action names', async ({ page }) => {
  await page.evaluate(() => window.sceneControlsFixture?.setLocalizedLabels())
  const forward = page.getByRole('button', { name: 'Avanzar' })
  await expect(forward).toHaveAttribute('aria-label', 'Avanzar')
  await forward.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Mantén para avanzar')
})

test('keyboard movement reports one pressed/released pair and blur releases a held key', async ({
  page,
}) => {
  const forward = page.getByRole('button', { name: 'Move forward' })
  const events = page.getByLabel('Interaction events')
  await forward.focus()
  await page.keyboard.down('Space')
  await page.keyboard.down('Space')
  await expect(forward).toHaveAttribute('aria-pressed', 'true')
  await expect(events).toHaveText('forward:down')
  await page.keyboard.up('Space')
  await expect(forward).toHaveAttribute('aria-pressed', 'false')
  await expect(events).toHaveText('forward:down,forward:up')

  await page.keyboard.down('Enter')
  await expect(events).toHaveText('forward:down,forward:up,forward:down')
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(events).toHaveText('forward:down,forward:up,forward:down,forward:up')
  await page.keyboard.up('Enter')
  await expect(events).toHaveText('forward:down,forward:up,forward:down,forward:up')
})

test('a held action releases through the callback that received its press', async ({ page }) => {
  const forward = page.getByRole('button', { name: 'Move forward' })
  const events = page.getByLabel('Interaction events')
  await forward.focus()
  await page.keyboard.down('Space')
  await expect(events).toHaveText('forward:down')
  await page.evaluate(() => window.sceneControlsFixture?.replaceMovementCallback())
  await page.keyboard.up('Space')
  await expect(events).toHaveText('forward:down,forward:up')
  await expect(page.getByLabel('Replacement events')).toBeEmpty()
})

test('pointer capture releases exactly once on unmount and ignores later up and blur', async ({
  page,
}) => {
  const forward = page.getByRole('button', { name: 'Move forward' })
  const events = page.getByLabel('Interaction events')
  await forward.hover()
  await page.mouse.down()
  await expect(forward).toHaveAttribute('aria-pressed', 'true')
  expect(await forward.evaluate((element: HTMLButtonElement) => element.hasPointerCapture(1))).toBe(
    true
  )
  await expect(events).toHaveText('forward:down')

  await page.evaluate(() => window.sceneControlsFixture?.unmount())
  await expect(forward).toHaveCount(0)
  await expect(events).toHaveText('forward:down,forward:up')
  await page.mouse.up()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(events).toHaveText('forward:down,forward:up')
})

test('removing movement capability while held releases its original callback once', async ({
  page,
}) => {
  const forward = page.getByRole('button', { name: 'Move forward' })
  const events = page.getByLabel('Interaction events')
  await forward.hover()
  await page.mouse.down()
  await expect(events).toHaveText('forward:down')
  await page.evaluate(() => window.sceneControlsFixture?.disableMovement())
  await expect(forward).toHaveCount(0)
  await expect(events).toHaveText('forward:down,forward:up')
  await page.mouse.up()
  await expect(events).toHaveText('forward:down,forward:up')
})

test('pointer up and lost capture each release a held action once', async ({ page }) => {
  const forward = page.getByRole('button', { name: 'Move forward' })
  const events = page.getByLabel('Interaction events')
  await forward.hover()
  await page.mouse.down()
  await expect(events).toHaveText('forward:down')
  await page.mouse.up()
  await expect(events).toHaveText('forward:down,forward:up')

  await page.evaluate(() => {
    window.sceneControlsPointerEvents = []
    window.addEventListener(
      'lostpointercapture',
      (event) =>
        window.sceneControlsPointerEvents?.push(
          `lost:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
        ),
      { capture: true }
    )
    window.addEventListener(
      'pointermove',
      (event) =>
        window.sceneControlsPointerEvents?.push(
          `move:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
        ),
      { capture: true }
    )
    window.addEventListener(
      'pointerup',
      (event) =>
        window.sceneControlsPointerEvents?.push(
          `up:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
        ),
      { capture: true }
    )
    window.addEventListener(
      'gotpointercapture',
      (event) =>
        window.sceneControlsPointerEvents?.push(
          `got:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
        ),
      { capture: true }
    )
    window.addEventListener(
      'pointerdown',
      (event) => {
        window.sceneControlsPointerId = event.pointerId
        window.sceneControlsPointerEvents?.push(
          `down:${event.pointerId}:${(event.target as HTMLElement).id || 'forward'}`
        )
      },
      { capture: true, once: true }
    )
  })
  await page.mouse.down()
  await expect(events).toHaveText('forward:down,forward:up,forward:down')
  const pointerId = await page.evaluate(() => window.sceneControlsPointerId)
  if (typeof pointerId !== 'number') throw new Error('Native pointerdown did not record an id')
  expect(
    await forward.evaluate(
      (element: HTMLButtonElement, id) => element.hasPointerCapture(id),
      pointerId
    )
  ).toBe(true)
  const bounds = await forward.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 1, bounds!.y + bounds!.height / 2 + 1)
  expect(await page.evaluate(() => window.sceneControlsPointerEvents ?? [])).toEqual([
    `down:${pointerId}:forward`,
    `got:${pointerId}:forward`,
    `move:${pointerId}:forward`,
  ])
  const captureTransfer = page.locator('#scene-controls-capture-transfer')
  await expect(captureTransfer).toHaveAccessibleName('Capture transfer target')
  await captureTransfer.evaluate(
    (element: HTMLButtonElement, id) => element.setPointerCapture(id),
    pointerId
  )
  await page.mouse.move(bounds!.x + bounds!.width + 8, bounds!.y + bounds!.height + 8)
  const nativePointerEvents = await page.evaluate(() => window.sceneControlsPointerEvents ?? [])
  expect(nativePointerEvents).toEqual([
    `down:${pointerId}:forward`,
    `got:${pointerId}:forward`,
    `move:${pointerId}:forward`,
    `lost:${pointerId}:forward`,
    `got:${pointerId}:scene-controls-capture-transfer`,
    `move:${pointerId}:scene-controls-capture-transfer`,
  ])
  await expect(events).toHaveText('forward:down,forward:up,forward:down,forward:up')
  await page.mouse.up()
  expect(await page.evaluate(() => window.sceneControlsPointerEvents?.at(-1))).toBe(
    `lost:${pointerId}:scene-controls-capture-transfer`
  )
  await expect(events).toHaveText('forward:down,forward:up,forward:down,forward:up')
})

test('pointer cancel releases a held action and a later up does not duplicate it', async ({
  page,
}) => {
  const forward = page.getByRole('button', { name: 'Move forward' })
  const events = page.getByLabel('Interaction events')
  await forward.hover()
  await page.mouse.down()
  await expect(events).toHaveText('forward:down')
  await forward.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  await expect(forward).toHaveAttribute('aria-pressed', 'false')
  await expect(events).toHaveText('forward:down,forward:up')
  await page.mouse.up()
  await expect(events).toHaveText('forward:down,forward:up')
})

test('zoom actions fire once on activation', async ({ page }) => {
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByLabel('Zoom activations')).toHaveText('1')
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(page.getByLabel('Zoom activations')).toHaveText('2')
})
