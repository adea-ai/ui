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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/empty-state.tsx'),
        formats: ['iife'],
        name: 'EmptyStateFixture',
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
    '<!doctype html><html lang="en"><head><title>Empty states</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('announces loading and errors with a heading and usable retry action', async ({ page }) => {
  const loading = page.locator('[data-slot=empty][role=status]')
  await expect(loading).toHaveAttribute('aria-live', 'polite')
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  await expect(loading.getByRole('heading', { name: 'Loading graph', level: 1 })).toBeVisible()
  await expect(loading.locator('[data-slot=spinner]')).toHaveAttribute('aria-hidden', 'true')

  const error = page.getByRole('alert')
  await expect(error.getByRole('heading', { name: 'Graph unavailable', level: 1 })).toBeVisible()
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  // Tab into the action: keyboard intent announces the tooltip (a programmatic
  // focus() is exactly what the tooltip focus gate keeps quiet).
  await page.keyboard.press('Tab')
  await expect(retry).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Retry loading the graph')
  await retry.click()
  await expect(page.getByLabel('Retries')).toHaveText('1')
})

test('a second action sits beside the primary one, after it in tab order, and is its own control', async ({
  page,
}) => {
  const state = page.getByTestId('two-actions')
  const primary = state.getByRole('button', { name: 'Retry status', exact: true })
  const secondary = state.getByRole('button', { name: 'Open settings', exact: true })
  await expect(
    state.getByRole('heading', { name: 'Sync health unavailable', level: 2 })
  ).toBeVisible()

  const [a, b] = await Promise.all([primary.boundingBox(), secondary.boundingBox()])
  // Side by side on one line, primary first, 8px apart.
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(1)
  expect(Math.round(b!.x - (a!.x + a!.width))).toBe(8)
  // The primary keeps the filled treatment; the secondary is the quieter variant.
  const fill = (locator: typeof primary) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(await fill(primary)).not.toBe(await fill(secondary))

  await page.getByRole('button', { name: 'Try again', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(primary).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(secondary).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Review configuration and resolve setup requirements.'
  )
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Settings opened')).toHaveText('1')
  await primary.click()
  await expect(page.getByLabel('Retries')).toHaveText('10')
})

test('a single action keeps the original layout: one centred column, no row wrapper', async ({
  page,
}) => {
  const content = page
    .getByRole('alert')
    .filter({ hasText: 'Graph unavailable' })
    .locator('[data-slot=empty-content]')
  await expect(content).toHaveCSS('flex-direction', 'column')
  await expect(content.getByRole('button')).toHaveCount(1)
})
