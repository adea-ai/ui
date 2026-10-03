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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/tooltip.tsx'),
        formats: ['iife'],
        name: 'TooltipFixture',
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
    '<!doctype html><html lang="en"><head><title>Tooltip</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('the tooltip never renders a caret', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Focus to open the force-mounted tooltip' })
  await trigger.focus()

  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  // The caret is a removed era: the tip reads as the rail's card-toned note,
  // and an arrow anchored into gutters more than once. Nothing vector should
  // ship inside one.
  await expect(tooltip.locator('svg')).toHaveCount(0)
})

test('a force-mounted tooltip leaves the accessibility tree as its close animation starts', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Focus to open the force-mounted tooltip' })
  const retainedTooltip = page.locator('[role="tooltip"]').filter({
    hasText: 'Tooltip without a caret',
  })

  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await trigger.focus()

  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveText('Tooltip without a caret')
  await expect(trigger).toHaveAttribute('aria-describedby', /.+/)
  await expect(retainedTooltip).not.toHaveAttribute('aria-hidden', 'true')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Next action' })).toBeFocused()
  await expect(retainedTooltip).toHaveAttribute('data-closed', '')
  await expect(retainedTooltip).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(trigger).not.toHaveAttribute('aria-describedby', /.+/)
  await expect
    .poll(() => retainedTooltip.evaluate((element) => getComputedStyle(element).animationName))
    .not.toBe('none')

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('a controlled tooltip hides caller-visible content only while closed', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Controlled tooltip trigger' })
  const retainedTooltip = page.locator('[role="tooltip"]').filter({
    hasText: 'Controlled tooltip description',
  })

  await expect(retainedTooltip).toHaveAttribute('aria-hidden', 'true')
  await page.getByRole('button', { name: 'Open controlled tooltip' }).click()
  await expect(page.getByRole('tooltip', { name: 'Controlled tooltip description' })).toBeVisible()
  await expect(retainedTooltip).toHaveAttribute('aria-hidden', 'false')
  const tooltipId = await retainedTooltip.getAttribute('id')
  if (!tooltipId) throw new Error('The open tooltip must expose its live content id')
  await expect(trigger).toHaveAttribute('aria-describedby', tooltipId)

  await page.getByRole('button', { name: 'Close controlled tooltip' }).click()
  await expect(retainedTooltip).toHaveAttribute('data-closed', '')
  await expect(retainedTooltip).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('tooltip', { name: 'Controlled tooltip description' })).toHaveCount(0)
  await expect(trigger).not.toHaveAttribute('aria-describedby', /.+/)
})

test('a closing tooltip stops intercepting the pointer', async ({ page }) => {
  const trigger = page.getByRole('button', {
    name: 'Focus to open the force-mounted tooltip',
  })
  const next = page.getByRole('button', { name: 'Next action' })

  await trigger.hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  // A tooltip is never interactive, and the placement draws it below its
  // action — where a hit-testing tip would hold the next control hostage.
  // The pointer belongs to the control underneath, open or departing.
  await expect(tip).toHaveCSS('pointer-events', 'none')
  await next.hover()
  await next.click()
  await expect(next).toBeFocused()
})
