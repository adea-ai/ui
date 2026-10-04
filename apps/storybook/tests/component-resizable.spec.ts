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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/resizable.tsx'),
        formats: ['iife'],
        name: 'ResizableFixture',
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
    '<!doctype html><html lang="en"><head><title>Resizable</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

const groups = [
  ['controlled', 'width', [0.3, 0.7]],
  ['horizontal', 'width', [0.28, 0.72]],
  ['vertical', 'height', [0.65, 0.35]],
  ['leading-unsized', 'width', [0.75, 0.25]],
  ['unsized', 'width', [1 / 3, 1 / 3, 1 / 3]],
] as const

for (const [testId, axis, expected] of groups) {
  test(`${testId}: an unsized panel takes the space its siblings leave`, async ({ page }) => {
    const group = page.getByTestId(testId).locator('[data-corvu-resizable-root]')
    const groupSize = (await group.boundingBox())![axis]
    const measure = (selector: string) =>
      group
        .locator(`:scope > ${selector}`)
        .evaluateAll(
          (elements, dimension) =>
            elements.map((element) => element.getBoundingClientRect()[dimension]),
          axis
        )
    const panels = await measure('[data-corvu-resizable-panel]')
    const handles = await measure('[data-corvu-resizable-handle]')
    const filled = [...panels, ...handles].reduce((total, size) => total + size, 0)

    expect(Math.abs(filled - groupSize)).toBeLessThan(1)
    const bases = await group
      .locator(':scope > [data-corvu-resizable-panel]')
      .evaluateAll((elements) => elements.map((element) => parseFloat(element.style.flexBasis)))
    expect(bases.map((basis) => Math.round(basis * 10) / 1000)).toEqual(
      expected.map((size) => Math.round(size * 1000) / 1000)
    )
  })
}

test('a handle is oriented across its group', async ({ page }) => {
  await expect(page.getByRole('separator', { name: 'Resize files' })).toHaveAttribute(
    'aria-orientation',
    'vertical'
  )
  await expect(page.getByRole('separator', { name: 'Resize terminal' })).toHaveAttribute(
    'aria-orientation',
    'horizontal'
  )
})
