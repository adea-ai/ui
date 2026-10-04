import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

declare global {
  interface Window {
    annotationSurfacePhases: string[]
    cancelAnnotationSurfacePointer: () => void
    disposeAnnotationSurface: () => void
    resetAnnotationSurface: () => void
    setAnnotationSurfaceInteractive: (value: boolean) => void
    setAnnotationSurfaceTool: (value: 'region' | 'point') => void
    transferAnnotationSurfaceCapture: () => void
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
          '../../../packages/ui/tests/fixtures/annotation-surface.tsx'
        ),
        formats: ['iife'],
        name: 'AnnotationSurfaceFixture',
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
  await page.setViewportSize({ width: 800, height: 600 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Annotation surface</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('is focusable, named, and forwards keyboard policy to the host', async ({ page }) => {
  const surface = page.getByRole('application', { name: /Frame preview/ })
  await expect(surface).toHaveAttribute('aria-roledescription', 'annotation surface')
  await expect(surface).toHaveAttribute('tabindex', '0')
  await expect(surface.getByText('Drag across the frame')).toBeVisible()
  const hintId = await surface.getAttribute('aria-describedby')
  expect(hintId).toBeTruthy()
  await expect(page.locator(`#${hintId}`)).toHaveText(/Drag across the frame/)
  await expect(surface.locator('svg')).toHaveCount(0)

  await surface.focus()
  await surface.press('ArrowRight')
  await expect(page.getByLabel('Keyboard events')).toHaveText('ArrowRight')
  await expect(surface).toBeFocused()
})

test('captures pointer drags and reports finite normalized region geometry', async ({ page }) => {
  const surface = page.getByRole('application', { name: /Frame preview/ })
  const box = (await surface.boundingBox())!

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await expect(surface).toHaveAttribute('data-dragging', 'true')
  await page.mouse.move(box.x + box.width + 12, box.y + box.height * 0.75)
  await expect(page.getByLabel('Pointer capture')).toHaveText('captured')
  await page.mouse.up()

  await expect(page.getByLabel('Pointer capture')).toHaveText('not captured')
  await expect(page.getByLabel('Interaction phases')).toHaveText('start,move,end')
  const coordinates = (await page.getByLabel('Annotation region').textContent())!
    .split(',')
    .map(Number)
  expect(coordinates[0]).toBeCloseTo(0.25, 2)
  expect(coordinates[1]).toBeCloseTo(0.25, 2)
  expect(coordinates[2]).toBeCloseTo(0.75, 2)
  expect(coordinates[3]).toBeCloseTo(0.5, 2)
})

test('Space creates a keyboard region and the host can clear it on Escape', async ({ page }) => {
  const surface = page.getByRole('application', { name: /Frame preview/ })
  await surface.focus()
  await surface.press('Space')
  await expect(page.getByLabel('Interaction phases')).toHaveText('keyboard')
  await expect(page.getByLabel('Annotation region')).toHaveText('0.250,0.250,0.500,0.500')
  await expect(surface.locator('svg')).toHaveCount(1)
  await surface.press('Escape')
  await expect(page.getByLabel('Keyboard events')).toHaveText('Space,Escape')
  await expect(page.getByLabel('Interaction phases')).toHaveText('keyboard,host-escape')
  await expect(page.getByLabel('Annotation region')).toHaveText('none')
  await expect(surface.locator('svg')).toHaveCount(0)

  await page.evaluate(() => window.setAnnotationSurfaceTool('point'))
  await surface.focus()
  await surface.press('Space')
  await expect(page.getByLabel('Annotation point')).toHaveText('0.500,0.500')
})

test('reset, native capture transfer, pointer cancel, disable, tool change, and unmount cancel once', async ({
  page,
}) => {
  const surface = page.getByRole('application', { name: /Frame preview/ })
  const box = (await surface.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await page.evaluate(() => window.resetAnnotationSurface())
  await page.mouse.up()
  await expect(page.getByLabel('Interaction phases')).toHaveText('start,cancel')

  await page.evaluate(() => window.setAnnotationSurfaceInteractive(true))
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.25 + 1, box.y + box.height * 0.25 + 1)
  await expect(page.getByLabel('Pointer capture')).toHaveText('captured')
  const captureTransferTarget = page.getByRole('button', { name: 'Capture transfer target' })
  await expect(captureTransferTarget).toBeVisible()
  await page.evaluate(() => window.transferAnnotationSurfaceCapture())
  await page.mouse.move(box.x + box.width * 0.25 + 2, box.y + box.height * 0.25 + 2)
  await expect(page.getByLabel('Interaction phases')).toHaveText('start,cancel,start,move,cancel')
  await page.mouse.up()
  await expect(page.getByLabel('Interaction phases')).toHaveText('start,cancel,start,move,cancel')

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await page.evaluate(() => window.cancelAnnotationSurfacePointer())
  await page.mouse.up()
  await expect(page.getByLabel('Interaction phases')).toHaveText(
    'start,cancel,start,move,cancel,start,cancel'
  )

  await page.evaluate(() => window.setAnnotationSurfaceInteractive(true))
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await page.evaluate(() => window.setAnnotationSurfaceInteractive(false))
  await expect(surface).toHaveAttribute('aria-disabled', 'true')
  expect(
    await surface.evaluate((element) => {
      const styles = getComputedStyle(element)
      return { cursor: styles.cursor, touchAction: styles.touchAction }
    })
  ).toEqual({ cursor: 'default', touchAction: 'auto' })
  await page.mouse.up()
  await expect(page.getByLabel('Interaction phases')).toHaveText(
    'start,cancel,start,move,cancel,start,cancel,start,cancel'
  )

  await page.evaluate(() => window.setAnnotationSurfaceInteractive(true))
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await page.evaluate(() => window.setAnnotationSurfaceTool('point'))
  await expect(surface).toHaveAttribute('data-tool', 'point')
  await expect(page.getByLabel('Interaction phases')).toHaveText(
    'start,cancel,start,move,cancel,start,cancel,start,cancel,start,cancel'
  )
  await page.mouse.up()

  await page.evaluate(() => window.setAnnotationSurfaceTool('region'))
  await expect(surface).toHaveAttribute('data-tool', 'region')
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25)
  await page.mouse.down()
  await page.evaluate(() => window.disposeAnnotationSurface())
  await page.mouse.up()
  expect(await page.evaluate(() => window.annotationSurfacePhases)).toEqual([
    'start',
    'cancel',
    'start',
    'move',
    'cancel',
    'start',
    'cancel',
    'start',
    'cancel',
    'start',
    'cancel',
    'start',
    'cancel',
  ])
})
