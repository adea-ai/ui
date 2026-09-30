import AxeBuilder from '@axe-core/playwright'
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
          '../../../packages/ui/tests/fixtures/catalog-browser.tsx'
        ),
        formats: ['iife'],
        name: 'CatalogBrowserFixture',
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

async function mountCatalog(page: Page) {
  await page.setContent(
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Catalog browser</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
}

test.beforeEach(async ({ page }) => mountCatalog(page))

test('tabs keep installed records and host supplemental navigation separate', async ({ page }) => {
  await expect(page.getByText('9 applications')).toBeVisible()
  const installed = page.getByRole('tab', { name: 'Installed', exact: true })
  await installed.click()
  await expect(page.getByText('2 applications')).toBeVisible()
  await expect(page.locator('[data-catalog-entry-id="terminal"]')).toBeVisible()
  await expect(page.locator('[data-catalog-entry-id="calendar"]')).toHaveCount(0)

  await installed.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Navigation', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByRole('region', { name: 'Navigation preferences' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search applications' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Discover', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search applications' }).fill('no matching app')
  await expect(page.getByText('No applications found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.locator('[data-catalog-entry-id="terminal"]')).toBeVisible()
})

test('detail actions report refusal and return keyboard focus to the selected result', async ({
  page,
}) => {
  const calendar = page.locator('[data-catalog-entry-id="calendar"]')
  await calendar.click()
  const details = page.getByRole('region', { name: 'Application details', exact: true })
  await expect(details).toHaveAttribute('tabindex', '0')
  const back = page.getByRole('button', { name: 'Back to catalog' })
  await expect(back).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible()
  await expect(
    page.getByRole('status').filter({
      hasText: 'Workspace approval is required before this application can be enabled.',
    })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable application' })).toBeDisabled()

  await page.getByRole('button', { name: 'Request install' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Install request was rejected. Nothing was installed.'
  )
  await back.click()
  await expect(calendar).toBeFocused()
})

test('loading and catalog failure expose clear recovery states', async ({ page }) => {
  const results = page.getByRole('region', { name: 'Application results', exact: true })
  await expect(results).toHaveAttribute('tabindex', '0')
  await page.getByRole('button', { name: 'Simulate catalog loading' }).click()
  await expect(results.getByLabel('Loading applications')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByText('Loading applications')).toBeVisible()

  await page.getByRole('button', { name: 'Simulate catalog failure' }).click()
  await expect(page.getByText('Catalog unavailable')).toBeVisible()
  await expect(
    page.getByText('The catalog could not be reached. Retry to check again.')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retry catalog' }).click()
  await expect(page.getByText('9 applications')).toBeVisible()
  await expect(page.locator('[data-catalog-entry-id="terminal"]')).toBeVisible()
})

test('long loading, error, and notice content scroll without an interactive child', async ({
  page,
}) => {
  const results = page.getByRole('region', { name: 'Application results', exact: true })
  const states = [
    { button: 'Show long loading notices', loading: true },
    { button: 'Show long error notices', loading: false },
  ]

  for (const state of states) {
    await page.getByRole('button', { name: state.button, exact: true }).click()
    if (state.loading) {
      await expect(results.getByLabel('Loading applications')).toHaveAttribute('aria-busy', 'true')
    } else {
      await expect(results.getByText('Catalog unavailable', { exact: true })).toBeVisible()
    }
    await expect(results.getByRole('button')).toHaveCount(0)
    await results.evaluate((element) => {
      element.scrollTop = 0
    })
    await results.focus()
    await page.keyboard.press('End')
    await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect(results.getByText(/Verification notice 18:/)).toBeInViewport()
  }
})

test('catalog and detail remain accessible in light and dark themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle('dark', value === 'dark')
    }, theme)
    await page.evaluate(async () => {
      const transitions = document.body
        .getAnimations()
        .filter((animation): animation is CSSTransition => animation instanceof CSSTransition)
      await Promise.all(transitions.map((transition) => transition.finished))
    })
    const catalog = await new AxeBuilder({ page }).include('main').analyze()
    expect(catalog.violations, `${theme} catalog violations`).toEqual([])

    await page.locator('[data-catalog-entry-id="calendar"]').click()
    const detail = await new AxeBuilder({ page }).include('main').analyze()
    expect(detail.violations, `${theme} detail violations`).toEqual([])
    await page.getByRole('button', { name: 'Back to catalog' }).click()
  }
})

test('narrow touch users can expand categories and reach every catalog card', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 780 },
    hasTouch: true,
    isMobile: true,
  })
  try {
    const page = await context.newPage()
    await mountCatalog(page)
    await expect(page.locator('[data-catalog-entry-id="calendar"]')).toBeVisible()
    await expect(page.locator('[data-catalog-entry-id="linear"]')).toHaveCount(0)
    const showMore = page.getByRole('button', { name: 'See Browser, Documentation and more' })
    const expansionToggle = page.locator('button[aria-expanded]').first()
    await expect(expansionToggle).toHaveAttribute('aria-expanded', 'false')
    const box = await showMore.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(24)
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(expansionToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'Show less' })).toBeVisible()
    await expect(page.locator('[data-catalog-entry-id="linear"]')).toBeVisible()
    await expect(page.locator('[data-catalog-entry-id="drive"]')).toBeVisible()
  } finally {
    await context.close()
  }
})
