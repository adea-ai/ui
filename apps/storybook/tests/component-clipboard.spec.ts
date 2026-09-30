import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string
type ClipboardTestWindow = Window & {
  clipboardWritten?: string
  legacyCalls?: number
  fallbackSnapshot?: Record<string, unknown>
}

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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/clipboard.tsx'),
        formats: ['iife'],
        name: 'ClipboardFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\\n')
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Clipboard helper</title></head><body></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('uses the async clipboard API first and preserves its rejection', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          const target = window as ClipboardTestWindow
          target.clipboardWritten = value
        },
      },
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => {
        const target = window as ClipboardTestWindow
        target.legacyCalls = (target.legacyCalls ?? 0) + 1
        return true
      },
    })
  })
  await page.getByRole('button', { name: 'Copy text' }).click()
  await expect(page.locator('#copy-result')).toHaveText('Copied')
  expect(await page.evaluate(() => (window as ClipboardTestWindow).clipboardWritten)).toBe(
    'sensitive context'
  )
  expect(await page.evaluate(() => (window as ClipboardTestWindow).legacyCalls ?? 0)).toBe(0)

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('permission denied')
        },
      },
    })
  })
  await page.getByRole('button', { name: 'Copy text' }).click()
  await expect(page.locator('#copy-result')).toHaveText('permission denied')
  expect(await page.evaluate(() => (window as ClipboardTestWindow).legacyCalls ?? 0)).toBe(0)
})

test('fallback removes its readonly textarea, restores focus, and rejects visibly on failure', async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (command: string) => {
        const textarea = document.activeElement as HTMLTextAreaElement
        const target = window as ClipboardTestWindow
        target.fallbackSnapshot = {
          command,
          value: textarea.value,
          readonly: textarea.readOnly,
          position: textarea.style.position,
          opacity: textarea.style.opacity,
          connected: textarea.isConnected,
        }
        return true
      },
    })
  })
  const trigger = page.getByRole('button', { name: 'Copy text' })
  const origin = page.getByRole('button', { name: 'Copy source' })
  await origin.focus()
  await trigger.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.locator('#copy-result')).toHaveText('Copied')
  expect(await page.evaluate(() => (window as ClipboardTestWindow).fallbackSnapshot)).toEqual({
    command: 'copy',
    value: 'sensitive context',
    readonly: true,
    position: 'fixed',
    opacity: '0',
    connected: true,
  })
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(origin).toBeFocused()

  await page.evaluate(() => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false })
  })
  await trigger.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.locator('#copy-result')).toHaveText('Clipboard is unavailable in this WebView')
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(origin).toBeFocused()
})
