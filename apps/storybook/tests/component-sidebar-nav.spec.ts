import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import AxeBuilder from '@axe-core/playwright'

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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/sidebar-nav.tsx'),
        formats: ['iife'],
        name: 'SidebarFixture',
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
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sidebar fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
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
