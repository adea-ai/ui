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
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/accent-selection.tsx'
        ),
        formats: ['iife'],
        name: 'AccentSelectionFixture',
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

async function mountFixture(page: Page) {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Accent selection</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  // Colour contracts measure settled paint: a mid-transition interpolation
  // would read as neither the old nor the new rung.
  await page.addStyleTag({ content: '*, ::before, ::after { transition: none !important }' })
  // Probe elements resolve the tokens the assertions compare against, so the
  // contract reads rendered colours, not class names. Built here rather than
  // in the fixture so the fixture carries no inline styles.
  await page.evaluate(() => {
    for (const [marker, declaration] of [
      ['subtle', 'background-color: var(--primary-subtle)'],
      ['primary', 'color: var(--primary)'],
    ] as const) {
      const probe = document.createElement('span')
      probe.setAttribute('data-accent-probe', marker)
      probe.setAttribute('style', declaration)
      document.body.append(probe)
    }
  })
}

const subtleOf = (page: Page) =>
  page
    .locator('[data-accent-probe="subtle"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor)
const primaryOf = (page: Page) =>
  page
    .locator('[data-accent-probe="primary"]')
    .evaluate((element) => getComputedStyle(element).color)
const backgroundOf = (locator: import('@playwright/test').Locator) =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor)

test('the accent rung renders on the states that report a choice', async ({ page }) => {
  await mountFixture(page)
  const subtle = await subtleOf(page)

  // A pressed toggle is the control's on state: accent tint, not a neutral fill.
  const pressedToggle = page.getByTestId('pressed-toggle')
  const idleToggle = page.getByTestId('idle-toggle')
  await expect(pressedToggle).toHaveAttribute('data-pressed', '')
  await expect(await backgroundOf(pressedToggle)).toBe(subtle)
  await expect(await backgroundOf(idleToggle)).not.toBe(subtle)

  // The command palette's selected row sits on the same rung.
  const input = page.getByTestId('palette').locator('input')
  await input.focus()
  // cmdk selects the first row on mount; ArrowDown moves the selection.
  await input.press('ArrowDown')
  await input.press('ArrowDown')
  const selectedItem = page.locator('[cmdk-item][data-selected="true"]')
  await expect(selectedItem).toContainText('Accent item')
  await expect(await backgroundOf(selectedItem)).toBe(subtle)

  // A segmented tab's selected trigger rides the same rung.
  const selectedTab = page.getByRole('tab', { name: 'Second' })
  await expect(await backgroundOf(selectedTab)).toBe(subtle)
})

test('checked menu indicators render the accent colour end to end', async ({ page }) => {
  await mountFixture(page)
  const primary = await primaryOf(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  const item = page.getByRole('menuitemcheckbox', { name: 'Visible layers' })
  await expect(item).toBeVisible()
  const indicator = item.locator('[data-slot="dropdown-menu-indicator"]')
  await expect(await indicator.evaluate((el) => getComputedStyle(el).color)).toBe(primary)
})
