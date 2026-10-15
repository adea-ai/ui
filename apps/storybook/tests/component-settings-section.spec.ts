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
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/settings-section.tsx'
        ),
        formats: ['iife'],
        name: 'SettingsSectionFixture',
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
    '<!doctype html><html lang="en"><head><title>Settings sections</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('content body spaces controls and cards without adding an enclosing row border', async ({
  page,
}) => {
  const rowsBody = page.locator('[data-testid="rows-section"] [data-slot="settings-section-body"]')
  const contentBody = page.locator(
    '[data-testid="content-section"] [data-slot="settings-section-body"]'
  )
  const card = page.getByTestId('settings-card')

  expect(await rowsBody.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('1px')
  expect(await contentBody.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
    '0px'
  )
  await expect(contentBody).toHaveCSS('gap', '16px')
  await expect(contentBody).toHaveCSS('display', 'flex')
  expect(await card.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('1px')
  await expect(page.getByTestId('field-content')).toBeVisible()
  await expect(page.getByText('Settings card')).toBeVisible()
})

test('a flush row aligns its label and control with the fields around it', async ({ page }) => {
  const edges = (testId: string) =>
    page.getByTestId(testId).evaluate((element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect()
      return { left, right, top, bottom }
    })
  const field = await edges('field-content')
  const flush = await edges('flush-row')
  const padded = await edges('padded-row')
  const flushLabel = await page
    .getByTestId('flush-row')
    .locator('[data-slot=settings-row-label]')
    .evaluate((element) => element.getBoundingClientRect().left)
  const paddedLabel = await page
    .getByTestId('padded-row')
    .locator('[data-slot=settings-row-label]')
    .evaluate((element) => element.getBoundingClientRect().left)
  const flushControl = await edges('flush-control')

  // Flush: the label starts where the neighbouring field starts and the control
  // ends on the section's content edge.
  expect(Math.round(flushLabel)).toBe(Math.round(field.left))
  expect(Math.round(flushControl.right)).toBe(Math.round(field.right))
  await expect(page.getByTestId('flush-row')).toHaveCSS('padding', '0px')
  // The row is no taller than its content, so the section gap is the only spacing.
  expect(flush.bottom - flush.top).toBeLessThan(padded.bottom - padded.top)
  // Default is unchanged: 16px of padding insets the label.
  expect(Math.round(paddedLabel - field.left)).toBe(16)
  await expect(page.getByTestId('padded-row')).toHaveCSS('padding', '16px')
})
