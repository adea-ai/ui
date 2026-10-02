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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/aspect-ratio.tsx'),
        formats: ['iife'],
        name: 'AspectRatioFixture',
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
  await page.setViewportSize({ width: 800, height: 600 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Aspect ratio</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

for (const testId of ['object-style', 'string-style']) {
  test(`${testId}: keeps its ratio alongside the caller's style`, async ({ page }) => {
    const { width, height, caller } = await page.getByTestId(testId).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        caller: getComputedStyle(element).getPropertyValue('--caller-style').trim(),
      }
    })
    expect(caller).toBe('kept')
    expect(height).toBeGreaterThan(0)
    expect(Math.abs(width / height - 2)).toBeLessThan(0.01)
  })
}
