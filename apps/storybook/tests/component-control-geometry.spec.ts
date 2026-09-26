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
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/control-geometry.tsx'
        ),
        formats: ['iife'],
        name: 'GeometryFixture',
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
for (const density of ['comfortable', 'compact'] as const) {
  for (const theme of ['light', 'dark']) {
    test(`${density}/${theme}: square icons and text controls use heights, not padding`, async ({
      page,
    }) => {
      await page.setContent(
        '<!doctype html><html lang="en"><head><title>Control geometry</title></head><body></body></html>'
      )
      await page.addStyleTag({ content: css })
      await page.addScriptTag({ content: script })
      await page.evaluate(
        ({ density: selectedDensity, theme: selectedTheme }) => {
          document.documentElement.dataset['density'] = selectedDensity
          document.documentElement.classList.toggle('dark', selectedTheme === 'dark')
        },
        { density, theme }
      )
      const scale = await page.evaluate(
        () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16
      )
      const heights = density === 'compact' ? [16, 20, 24, 28, 32, 36] : [20, 24, 28, 32, 36, 40]
      const paddings = density === 'compact' ? [4, 6, 8, 10, 12, 14] : [6, 8, 10, 12, 14, 16]
      const actual = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-control]')].map((element) => {
          const size = element.dataset['control']
          const icon = document.querySelector<HTMLElement>(`[data-icon="${size}"]`)!
          const regular = getComputedStyle(element)
          const square = getComputedStyle(icon)
          return {
            height: parseFloat(regular.height),
            padding: parseFloat(regular.paddingInlineStart),
            iconHeight: parseFloat(square.height),
            iconWidth: parseFloat(square.width),
          }
        })
      )
      expect(actual).toEqual(
        heights.map((height, index) => ({
          height: height * scale,
          padding: paddings[index]! * scale,
          iconHeight: height * scale,
          iconWidth: height * scale,
        }))
      )
    })
  }
}
