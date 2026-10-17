import { expect, test, type Page } from '@playwright/test'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/card-header.tsx'),
        formats: ['iife'],
        name: 'CardHeaderFixture',
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
    '<!doctype html><html lang="en"><head><title>Card headers</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

const mid = (b: { top: number; bottom: number }) => (b.top + b.bottom) / 2

const box = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    return { left, right, top, bottom }
  })

test('a trailing action sits at the header end, level with the title', async ({ page }) => {
  const header = await box(page, 'action-header')
  const slot = await box(page, 'action-slot')
  const title = await page
    .getByText('Release 0.55.0')
    .evaluate((element) => element.getBoundingClientRect())
  const description = await page
    .getByText('Cut from main on 24 September.')
    .evaluate((element) => element.getBoundingClientRect())

  // The header's own 16px inline padding is the edge the action aligns to.
  expect(Math.round(header.right - slot.right)).toBe(16)
  expect(slot.top).toBeLessThan(title.bottom)
  // The copy stays in the leading column, below each other and clear of the action.
  expect(description.top).toBeGreaterThanOrEqual(title.bottom)
  expect(title.right).toBeLessThanOrEqual(slot.left)
  expect(description.right).toBeLessThanOrEqual(slot.left)
})

test('a title-only header wraps the title before the action instead of under it', async ({
  page,
}) => {
  const slot = await box(page, 'title-only-slot')
  const title = await box(page, 'title-only-title')
  expect(title.right).toBeLessThanOrEqual(slot.left)
  expect(slot.top).toBeLessThanOrEqual(title.top + 1)
})

test('a one-line title and an icon action centre on each other with layout classes only', async ({
  page,
}) => {
  const slot = await box(page, 'centered-slot')
  const title = await box(page, 'centered-title')
  const header = await box(page, 'centered-header')
  expect(Math.abs(mid(title) - mid(slot))).toBeLessThan(1)
  // The header is exactly as tall as the action: no empty second row.
  expect(Math.round(header.bottom - header.top)).toBe(Math.round(slot.bottom - slot.top))
})

test('a header without an action is unchanged: stacked, full width, 4px apart', async ({
  page,
}) => {
  const title = await page.getByText('Nightly soak').evaluate((e) => e.getBoundingClientRect())
  const description = await page
    .getByText('Runs the endurance lane at 02:00.')
    .evaluate((e) => e.getBoundingClientRect())
  const bounds = await box(page, 'plain-header')

  expect(Math.round(description.top - title.bottom)).toBe(4)
  expect(Math.round(title.left - bounds.left)).toBe(16)
  expect(Math.round(bounds.right - title.right)).toBe(16)
})

test('the small card keeps the action on the 12px header padding', async ({ page }) => {
  const header = await box(page, 'small-header')
  const slot = await box(page, 'small-slot')
  expect(Math.round(header.right - slot.right)).toBe(12)
})

test('a CardAction inside a caller wrapper does not turn the header into two columns', async ({
  page,
}) => {
  // `has-data-[slot=card-action]` matches at any depth; the second column must
  // only appear for a direct-child action, or the wrapper shrinks to one column.
  const header = await box(page, 'wrapped-header')
  const row = await box(page, 'wrapped-row')
  expect(Math.round(row.left - header.left)).toBe(16)
  expect(Math.round(header.right - row.right)).toBe(16)
  await expect(page.getByTestId('wrapped-header')).toHaveCSS(
    'grid-template-columns',
    /^\d+(\.\d+)?px$/
  )
})
