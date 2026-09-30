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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/thread-panel.tsx'),
        formats: ['iife'],
        name: 'ThreadFixture',
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
    '<!doctype html><html lang="en"><head><title>Thread fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('host actions and close retain separate keyboard actions and tooltip', async ({
  page,
  browserName,
}) => {
  const panel = page.getByRole('complementary', { name: 'Thread: Synthetic thread' })
  const unread = panel.getByRole('button', { name: 'Mark unread' })
  await unread.focus()
  await unread.press('Enter')
  await expect(page.getByLabel('Unread count')).toHaveText('1')
  await expect(page.getByLabel('Close count')).toHaveText('0')
  // macOS WebKit follows the system preference to skip buttons on Tab.
  await page.keyboard.press(
    browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
  )
  const close = panel.getByRole('button', { name: 'Close thread' })
  await expect(close).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Close thread')
  await close.press('Enter')
  await expect(page.getByLabel('Close count')).toHaveText('1')
  await expect(page.getByLabel('Unread count')).toHaveText('1')
  await expect(panel.getByRole('region', { name: 'Thread replies' })).toBeVisible()
})

test('a narrow host keeps thread actions inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 })
  const panel = page.getByRole('complementary', { name: 'Thread: Synthetic thread' })
  const box = await panel.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  await expect(panel.getByRole('button', { name: 'Mark unread' })).toBeInViewport()
  await expect(panel.getByRole('button', { name: 'Close thread' })).toBeInViewport()
})
