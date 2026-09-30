import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import AxeBuilder from '@axe-core/playwright'

let script: string
let css: string
const packedRoot = process.env['ADEA_SIDEBAR_PACKED_ROOT']
const packedCondition = process.env['ADEA_SIDEBAR_PACKED_CONDITION']

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid') {
  throw new Error('Packed sidebar fixture requires an explicit package condition')
}

test.beforeAll(async () => {
  const result = await build({
    root: packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && packedCondition === 'compiled'
        ? [
            {
              name: 'compiled-sidebar-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (condition) => condition !== 'solid' && condition !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: packedRoot
      ? { conditions: packedCondition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: false,
      lib: {
        entry: packedRoot
          ? resolve(packedRoot, 'sidebar.tsx')
          : resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/sidebar-nav.tsx'),
        formats: ['iife'],
        name: 'SidebarFixture',
        cssFileName: 'sidebar-fixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  if (packedRoot) {
    const modules = assets
      .flatMap((asset) => (asset.type === 'chunk' ? Object.keys(asset.modules) : []))
      .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = packedCondition === 'compiled' ? '/dist/' : '/src/'
    if (!modules.some((id) => id.includes(expected)))
      throw new Error(`Packed sidebar did not resolve from ${packedCondition}`)
    if (modules.some((id) => id.includes(packedCondition === 'compiled' ? '/src/' : '/dist/')))
      throw new Error('Packed sidebar mixed compiled and Solid-source package conditions')
  }
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
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sidebar fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('shared sidebar resizing exposes pixel values and bounded keyboard commits', async ({
  page,
}) => {
  const handle = page.getByRole('separator', { name: 'Resize workspace navigation' })
  await expect(handle).toHaveAttribute('aria-orientation', 'vertical')
  await expect(handle).toHaveAttribute('aria-controls', 'resize-pane')
  await expect(handle).toHaveAttribute('aria-valuemin', '208')
  await expect(handle).toHaveAttribute('aria-valuemax', '448')
  await expect(handle).toHaveAttribute('aria-valuenow', '272')
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Navigation width', { exact: true })).toHaveText('288')
  await expect(page.getByLabel('Committed navigation width', { exact: true })).toHaveText('288')
  await page.keyboard.press('Home')
  await expect(handle).toHaveAttribute('aria-valuenow', '208')
  await page.keyboard.press('ArrowLeft')
  await expect(handle).toHaveAttribute('aria-valuenow', '208')
  await page.keyboard.press('End')
  await expect(handle).toHaveAttribute('aria-valuenow', '448')
  await page.keyboard.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '448')
})

test('shared sidebar pointer resizing commits the final bounded value', async ({ page }) => {
  const handle = page.getByRole('separator', { name: 'Resize workspace navigation' })
  await handle.scrollIntoViewIfNeeded()
  const bounds = await handle.boundingBox()
  expect(bounds).not.toBeNull()
  const x = bounds!.x + bounds!.width / 2
  const y = bounds!.y + bounds!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 100, y, { steps: 5 })
  await page.mouse.up()
  const changed = Number(await page.getByLabel('Navigation width', { exact: true }).textContent())
  expect(changed).toBeGreaterThanOrEqual(370)
  expect(changed).toBeLessThanOrEqual(374)
  await expect(page.getByLabel('Committed navigation width', { exact: true })).toHaveText(
    String(changed)
  )
})

test('host heading hierarchy and disclosure semantics survive shared composition', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' })
  await expect(nav.getByRole('heading', { level: 1, name: 'Workspace', exact: true })).toBeVisible()
  await expect(nav.getByRole('heading', { level: 2, name: 'Rooms', exact: true })).toBeVisible()
  const conversations = nav.getByRole('heading', { level: 2, name: 'Conversations', exact: true })
  await expect(conversations).toBeVisible()
  await expect(conversations.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  await expect(conversations.getByRole('button', { name: 'New conversation' })).toHaveCount(0)
  const disclosure = conversations.getByRole('button')
  await disclosure.focus()
  await disclosure.press('Enter')
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await expect(nav.getByRole('button', { name: 'Research' })).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'New conversation' })).toBeVisible()
  await disclosure.press('Space')
  await expect(nav.getByRole('button', { name: 'Research' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test('controlled sections preserve independent saved state and disclosure trigger contracts', async ({
  page,
}) => {
  const projects = page.getByRole('button', { name: 'Projects', exact: true })
  const agents = page.getByRole('button', { name: 'Agents', exact: true })
  const cancelable = page.getByRole('button', { name: 'Cancelable', exact: true })

  await expect(projects).toHaveAttribute('id', 'projects-section-disclosure')
  await expect(projects).toHaveAttribute(
    'aria-description',
    'Press Alt with Arrow Up or Arrow Down to reorder Projects.'
  )
  await expect(projects).toHaveAttribute('draggable', 'true')
  await expect(projects).toHaveAttribute('data-ref-confirmed', 'true')
  await expect(projects).toHaveAttribute('aria-expanded', 'true')
  await expect(agents).toHaveAttribute('aria-expanded', 'false')

  await projects.press('Alt+ArrowDown')
  await expect(page.getByLabel('Section reorder direction', { exact: true })).toHaveText('down')
  await projects.dispatchEvent('dragstart')
  await expect(page.getByLabel('Section drag started', { exact: true })).toHaveText('true')

  await projects.click()
  await expect(projects).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Saved projects disclosure', { exact: true })).toHaveText('false')
  await agents.click()
  await expect(agents).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByLabel('Saved agents disclosure', { exact: true })).toHaveText('true')
  await expect(projects).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Show matching sections' }).click()
  await expect(
    projects.locator('xpath=../../..').getByRole('button', { name: 'Product' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Research Agent', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear section filter' }).click()
  await expect(projects).toHaveAttribute('aria-expanded', 'false')
  await expect(agents).toHaveAttribute('aria-expanded', 'true')

  await cancelable.click()
  await expect(page.getByLabel('Canceled disclosure clicks', { exact: true })).toHaveText('1')
  await expect(cancelable).toHaveAttribute('aria-expanded', 'false')
  await cancelable.press('Alt+ArrowDown')
  await expect(page.getByLabel('Section reorder direction', { exact: true })).toHaveText('down')
  await expect(page.getByLabel('Canceled disclosure reorder', { exact: true })).toHaveText('false')

  await page.setViewportSize({ width: 320, height: 640 })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%'
  })
  await expect(projects).toBeVisible()
  await expect(projects).toHaveAttribute('aria-expanded', 'false')

  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test.describe('touch navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('section creation actions remain discoverable without hover', async ({ page }) => {
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true)
    for (const name of ['New Room', 'New conversation']) {
      const action = page.getByRole('button', { name, exact: true })
      await expect(action).toBeInViewport()
      await expect(action.locator('..')).toHaveCSS('opacity', '1')
      await action.tap()
    }
    await expect(page.getByLabel('Created sections')).toHaveText('2')
  })
})
