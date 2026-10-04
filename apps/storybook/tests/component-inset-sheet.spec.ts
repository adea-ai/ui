import { expect, test } from '@playwright/test'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/inset-sheet.tsx'),
        formats: ['iife'],
        name: 'InsetSheetFixture',
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
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Inset sheet fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await page.getByRole('button', { name: 'Edit task' }).click()
})

test('an end Sheet docks below the top bar with one equal gap and no scrim', async ({ page }) => {
  const sheet = page.getByRole('dialog', { name: 'Edit task' })
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveAttribute('data-variant', 'inset')
  const topBar = await page.evaluate(
    () =>
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')
      ) * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  )
  // Measure the settled panel, not a frame of its slide-in.
  await sheet.evaluate(async (element) => {
    // Opening can replace the first animation; a canceled finished promise is
    // an AbortError. Wait for its replacement before measuring the same geometry.
    let animations = element
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
    while (animations.length) {
      await Promise.all(
        animations.map((animation) =>
          animation.finished.catch((error: unknown) => {
            if (!(error instanceof DOMException && error.name === 'AbortError')) throw error
          })
        )
      )
      animations = element.getAnimations().filter((animation) => animation.playState === 'running')
    }
  })
  const box = (await sheet.boundingBox())!
  const gap = 1280 - (box.x + box.width)
  expect(gap).toBeGreaterThan(0)
  expect(box.y - topBar).toBeCloseTo(gap, 0)
  expect(800 - (box.y + box.height)).toBeCloseTo(gap, 0)
  // The work stays visible: no dimming layer behind an inset panel.
  await expect(page.locator('[class*="bg-scrim"]')).toHaveCount(0)
  // The footer band runs the full inner width of the panel.
  const footer = (await sheet.locator('[data-slot="sheet-footer"]').boundingBox())!
  expect(footer.width).toBeGreaterThanOrEqual(box.width - 2)
  await expect(sheet.getByRole('button', { name: 'Close task' })).toBeVisible()
})

test('a Select inside the Sheet opens on the first click and stays reachable', async ({ page }) => {
  const sheet = page.getByRole('dialog', { name: 'Edit task' })
  await sheet.getByRole('button', { name: /Priority/ }).click()
  // By role: a list hidden from assistive technology would not be found.
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  await page.waitForTimeout(300)
  await expect(listbox).toBeVisible()
  await listbox.getByRole('option', { name: 'Urgent' }).click()
  await expect(sheet.getByRole('button', { name: /Priority/ })).toContainText('Urgent')
  await expect(sheet).toBeVisible()
})

test('a menu inside the Sheet is reachable, and Escape closes only the menu', async ({ page }) => {
  const sheet = page.getByRole('dialog', { name: 'Edit task' })
  await sheet.getByRole('button', { name: /^Type:/ }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: /^Type:/ }).click()
  await page.getByRole('menuitem', { name: 'Bug' }).click()
  await expect(sheet.getByRole('button', { name: /^Type:/ })).toContainText('Bug')
  await expect(sheet).toBeVisible()
})
