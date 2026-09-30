import { expect, test } from '@playwright/test'
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
          '../../../packages/ui/tests/fixtures/virtual-orbit-layout.tsx'
        ),
        formats: ['iife'],
        name: 'GeometryLayoutFixture',
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
    '<!doctype html><html lang="en"><head><title>Geometry layouts</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('orbit items occupy measured cardinal positions and retain accessible source order', async ({
  page,
}) => {
  const host = page.locator('[data-orbit-host]')
  const hostBox = (await host.boundingBox())!
  const centers = await page.locator('[data-orbit-item]').evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    })
  )
  const center = { x: hostBox.x + hostBox.width / 2, y: hostBox.y + hostBox.height / 2 }

  expect(centers[0]!.x - center.x).toBeCloseTo(68, 0)
  expect(centers[0]!.y - center.y).toBeCloseTo(0, 0)
  expect(centers[1]!.x - center.x).toBeCloseTo(0, 0)
  expect(centers[1]!.y - center.y).toBeCloseTo(68, 0)
  expect(centers[2]!.x - center.x).toBeCloseTo(-68, 0)
  expect(centers[2]!.y - center.y).toBeCloseTo(0, 0)
  expect(centers[3]!.x - center.x).toBeCloseTo(0, 0)
  expect(centers[3]!.y - center.y).toBeCloseTo(-68, 0)
  await expect(page.getByRole('listitem')).toHaveCount(6)

  const buttons = host.getByRole('button')
  const buttonNames = await buttons.evaluateAll((buttonElements) =>
    buttonElements.map((button) => button.getAttribute('aria-label'))
  )
  expect(buttonNames).toEqual(['North', 'East', 'South', 'West'])

  await page.getByRole('button', { name: 'Add orbit point' }).click()
  await expect(host.locator('[data-slot="orbit-item"]')).toHaveCount(5)
  await expect(page.getByRole('listitem')).toHaveCount(7)
  const east = host.locator('[data-orbit-item="East"]')
  const eastBox = (await east.boundingBox())!
  const hostAfterAppend = (await host.boundingBox())!
  const centerAfterAppend = {
    x: hostAfterAppend.x + hostAfterAppend.width / 2,
    y: hostAfterAppend.y + hostAfterAppend.height / 2,
  }
  expect(eastBox.x + eastBox.width / 2 - centerAfterAppend.x).toBeCloseTo(
    68 * Math.cos((2 * Math.PI) / 5),
    0
  )
  expect(eastBox.y + eastBox.height / 2 - centerAfterAppend.y).toBeCloseTo(
    68 * Math.sin((2 * Math.PI) / 5),
    0
  )

  await page.setViewportSize({ width: 200, height: 720 })
  const eastAtNarrowWidth = (await east.boundingBox())!
  expect(eastAtNarrowWidth.x + eastAtNarrowWidth.width / 2 - centerAfterAppend.x).toBeCloseTo(
    58 * Math.cos((2 * Math.PI) / 5),
    0
  )
  expect(
    (await new AxeBuilder({ page }).include('[data-orbit-host]').analyze()).violations
  ).toEqual([])

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Use flow layout' }).click()
  await expect(host.locator('[data-slot="orbit-item"]').first()).toHaveCSS('position', 'static')
  expect(
    await host
      .locator('[data-slot="orbit-item"]')
      .first()
      .evaluate((item) => ({
        absoluteClass: item.classList.contains('absolute'),
        top: (item as HTMLElement).style.top,
        left: (item as HTMLElement).style.left,
        translate: (item as HTMLElement).style.translate,
      }))
  ).toEqual({ absoluteClass: false, top: '', left: '', translate: '' })
  expect(
    await host.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
    )
  ).toBe(2)

  await page.setViewportSize({ width: 200, height: 720 })
  expect(
    await host.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
    )
  ).toBe(1)
  expect(
    (await new AxeBuilder({ page }).include('[data-orbit-host]').analyze()).violations
  ).toEqual([])
})

test('virtual window reserves full list height and translates mounted rows by the requested offset', async ({
  page,
}) => {
  const space = page.locator('[data-slot="virtual-window-space"]')
  const content = page.locator('[data-slot="virtual-window-content"]')
  const row = page.locator('[data-virtual-row]')
  const spaceBox = (await space.boundingBox())!
  const rowBox = (await row.boundingBox())!

  expect(spaceBox.height).toBe(640)
  expect(rowBox.y - spaceBox.y).toBe(160)
  await expect(content).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 160)')
  expect(
    (await new AxeBuilder({ page }).include('[data-virtual-viewport]').analyze()).violations
  ).toEqual([])

  await page.getByRole('button', { name: 'Advance virtual window' }).click()
  expect((await space.boundingBox())!.height).toBe(800)
  expect((await row.boundingBox())!.y - (await space.boundingBox())!.y).toBe(240)
  await expect(content).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 240)')
})
