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
          '../../../packages/ui/tests/fixtures/overlay-composition.tsx'
        ),
        formats: ['iife'],
        name: 'OverlayCompositionFixture',
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

/** Mounts one scenario and returns the page errors it raises from then on. */
async function mount(page: Page, scenario: string): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Overlay composition</title></head><body></body></html>'
  )
  await page.evaluate((name) => {
    ;(window as Window & { overlayScenario?: string }).overlayScenario = name
  }, scenario)
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  return errors
}

for (const [scenario, trigger, item] of [
  ['navigation-menu-default', 'Guides', 'Installation'],
  ['navigation-menu-single', 'Resources', 'Documentation'],
  ['navigation-menu-descriptions', 'Products', 'Agent HQ'],
] as const) {
  test(`${scenario}: opening a panel paints its links without an error`, async ({ page }) => {
    const errors = await mount(page, scenario)

    await page.getByRole('menuitem', { name: trigger }).click()

    const link = page.getByRole('menuitem', { name: item })
    await expect(link).toBeVisible()
    expect(errors).toEqual([])
    // The panel is portalled into the one shared viewport, not painted in place
    // inside the bar.
    await expect(page.locator('[data-slot="navigation-menu-viewport"]')).toContainText(item)
    const box = await link.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(0)
  })
}

test('navigation-menu-default: moving between entries swaps the panel without an error', async ({
  page,
}) => {
  const errors = await mount(page, 'navigation-menu-default')

  await page.getByRole('menuitem', { name: 'Guides' }).click()
  await expect(page.getByRole('menuitem', { name: 'Installation' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Components' }).hover()
  await expect(page.getByRole('menuitem', { name: 'Button' })).toBeVisible()
  // The outgoing panel leaves the shared viewport rather than painting under the
  // incoming one.
  await expect(page.getByRole('menuitem', { name: 'Installation' })).toHaveCount(0)
  const viewport = await page.locator('[data-slot="navigation-menu-viewport"]').boundingBox()
  const button = await page.getByRole('menuitem', { name: 'Button' }).boundingBox()
  if (!viewport || !button) throw new Error('The viewport and its panel must both have a box')
  expect(button.x + button.width).toBeLessThanOrEqual(viewport.x + viewport.width)
  expect(button.y + button.height).toBeLessThanOrEqual(viewport.y + viewport.height)
  expect(errors).toEqual([])
})

for (const [scenario, label, item] of [
  ['dropdown-menu-grouped', 'This file', 'Rename'],
  ['context-menu-default', 'side-rail.tsx', 'Copy path'],
  ['menubar-default', 'Session', 'New session'],
] as const) {
  test(`${scenario}: a labelled group opens and names its group`, async ({ page }) => {
    const errors = await mount(page, scenario)

    if (scenario === 'dropdown-menu-grouped') {
      await page.getByRole('button', { name: 'File' }).click()
    } else if (scenario === 'context-menu-default') {
      await page.getByText('side-rail.tsx').click({ button: 'right' })
    } else {
      await page.getByRole('menuitem', { name: 'File' }).click()
    }

    await expect(page.getByRole('menuitem', { name: item })).toBeVisible()
    expect(errors).toEqual([])
    // The label is the group's accessible name, which only holds when the label
    // sits inside the group it names.
    await expect(page.getByRole('group', { name: label })).toBeVisible()
  })
}

test('drawer-from-the-side: the inspector opens from the right edge', async ({ page }) => {
  const errors = await mount(page, 'drawer-from-the-side')

  await page.getByRole('button', { name: 'Open inspector' }).click()

  const drawer = page.getByRole('dialog', { name: 'Worktree' })
  await expect(drawer).toHaveAttribute('data-side', 'right')
  await expect(drawer).not.toHaveAttribute('data-transitioning', '')
  const viewport = page.viewportSize()
  const box = await drawer.boundingBox()
  if (!viewport || !box) throw new Error('The drawer and viewport must both have a size')
  expect(Math.round(box.x + box.width)).toBe(viewport.width)
  expect(box.y).toBe(0)
  expect(Math.round(box.height)).toBe(viewport.height)
  expect(errors).toEqual([])
})

test('toaster: each region sits in its documented corner', async ({ page }) => {
  const errors = await mount(page, 'toasters')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('The page must have a viewport')

  for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
    await page.getByRole('button', { name: `Show ${position}` }).click()
    await expect(page.getByText(`Toast ${position}`)).toBeVisible()

    const region = await page.getByTestId(`toaster-${position}`).boundingBox()
    if (!region) throw new Error(`The ${position} region must have a box`)
    const [vertical, horizontal] = position.split('-')

    if (vertical === 'top') expect(region.y).toBe(0)
    else expect(Math.round(region.y + region.height)).toBe(viewport.height)
    if (horizontal === 'left') expect(region.x).toBe(0)
    else expect(Math.round(region.x + region.width)).toBe(viewport.width)

    // The toast itself, not just its region, lands on the documented edge.
    const card = await page
      .getByTestId(`toaster-${position}`)
      .locator('li')
      .filter({ hasText: `Toast ${position}` })
      .boundingBox()
    if (!card) throw new Error(`The ${position} toast must have a box`)
    if (vertical === 'top') expect(card.y).toBeLessThan(viewport.height / 2)
    else expect(card.y).toBeGreaterThan(viewport.height / 2)
    if (horizontal === 'left') expect(card.x).toBeLessThan(viewport.width / 2)
    else expect(card.x + card.width).toBeGreaterThan(viewport.width / 2)
  }
  expect(errors).toEqual([])
})
