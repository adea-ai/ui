import AxeBuilder from '@axe-core/playwright'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/list-row.tsx'),
        formats: ['iife'],
        name: 'ListRowFixture',
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
    '<!doctype html><html lang="en"><head><title>ListRow</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('preserves native button and link semantics, refs, events, and keyboard tooltips', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Open report' })
  const link = page.getByRole('link', { name: 'Details' })
  const defaultAction = page.getByRole('button', { name: 'Run action' })
  const explicitNegative = page.getByRole('button', { name: 'Skip tab order' })
  const staticRow = page.getByText('Static row')

  await expect(button).toHaveAttribute('tabindex', '0')
  await expect(link).toHaveAttribute('tabindex', '0')
  await expect(defaultAction).toHaveAttribute('tabindex', '0')
  await expect(explicitNegative).toHaveAttribute('tabindex', '-1')
  await expect(staticRow).not.toHaveAttribute('tabindex')

  await expect(button).toHaveAttribute('type', 'button')
  await expect(link).toHaveAttribute('href', '#details')
  await expect(defaultAction).toHaveAttribute('type', 'button')
  await expect(page.getByLabel('Forwarded ref')).toHaveText('BUTTON')

  await button.focus()
  await expect(page.getByRole('tooltip', { name: 'Open the report' })).toHaveText('Open the report')
  await expect(button).toHaveAttribute('aria-describedby', /.+/)
  await button.press('Enter')
  await button.press('Space')
  await expect(page.getByLabel('Activations')).toHaveText('2')
  await expect(page.getByLabel('Submissions')).toHaveText('0')

  await link.focus()
  await expect(link).toBeFocused()
  await expect(page.getByRole('tooltip', { name: 'Read report details' })).toHaveText(
    'Read report details'
  )
  await expect(link).toHaveAttribute('aria-describedby', /.+/)

  await defaultAction.click()
  await expect(page.getByLabel('Activations')).toHaveText('3')
  await expect(page.getByLabel('Submissions')).toHaveText('0')
})

test('interactive native rows participate in sequential Tab navigation', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Open report' })
  const link = page.getByRole('link', { name: 'Details' })
  const defaultAction = page.getByRole('button', { name: 'Run action' })

  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(link).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(defaultAction).toBeFocused()
})

test('description rows grow to contain both lines without overlapping neighbors', async ({
  page,
}) => {
  const rows = [
    page.getByTestId('description-row-regular'),
    page.getByTestId('description-row-dense'),
  ]
  const descriptions = page.locator('[data-slot="list-row-description"]')
  const rowBoxes = await Promise.all(rows.map((row) => row.boundingBox()))
  const descriptionBoxes = await Promise.all(
    [0, 1].map((index) => descriptions.nth(index).boundingBox())
  )

  expect(rowBoxes.every((box) => box !== null)).toBe(true)
  expect(descriptionBoxes.every((box) => box !== null)).toBe(true)
  expect(descriptionBoxes[0]!.y + descriptionBoxes[0]!.height).toBeLessThanOrEqual(
    rowBoxes[0]!.y + rowBoxes[0]!.height
  )
  expect(descriptionBoxes[1]!.y + descriptionBoxes[1]!.height).toBeLessThanOrEqual(
    rowBoxes[1]!.y + rowBoxes[1]!.height
  )
  expect(rowBoxes[1]!.y).toBeGreaterThanOrEqual(rowBoxes[0]!.y + rowBoxes[0]!.height)
})

test('interactive row composition has no serious or critical accessibility violations', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})
