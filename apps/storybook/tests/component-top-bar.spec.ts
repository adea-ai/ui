import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string
test.beforeAll(async () => {
  const packedRoot = process.env['ADEA_TOPBAR_PACKED_ROOT']
  const condition = process.env['ADEA_TOPBAR_PACKED_CONDITION']
  if (packedRoot && condition !== 'compiled' && condition !== 'solid')
    throw new Error('Packed toolbar requires an explicit browser condition')
  const result = await build({
    root: packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && condition === 'compiled'
        ? [
            {
              name: 'compiled-toolbar-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: import('vite').EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (value) => value !== 'solid' && value !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: packedRoot
      ? { conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: false,
      lib: {
        entry: packedRoot
          ? resolve(packedRoot, 'topbar.tsx')
          : resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/top-bar.tsx'),
        formats: ['iife'],
        name: 'TopBarFixture',
      },
    },
  })
  const assets = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
  if (packedRoot) {
    const modules = assets.flatMap((asset) =>
      asset.type === 'chunk'
        ? Object.entries(asset.modules)
            .filter(([, data]) => data.renderedLength > 0)
            .map(([id]) => id)
        : []
    )
    const ui = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = condition === 'compiled' ? '/dist/' : '/src/'
    if (!ui.length || !ui.every((id) => id.includes(expected)))
      throw new Error('Toolbar export conditions mixed or missing')
  }
  script = assets.flatMap((asset) => (asset.type === 'chunk' ? [asset.code] : [])).join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test('toolbar actions remain reachable without document overflow at narrow widths and enlarged text', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Toolbar</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const toolbar = page.getByRole('banner', { name: 'Workspace toolbar' })
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const factor of [1, 2]) {
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${16 * scale}px`
      }, factor)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
      const buttons = toolbar.getByRole('button')
      for (let index = 0; index < (await buttons.count()); index++) {
        const button = buttons.nth(index)
        await button.focus()
        const visible = await button.evaluate((element) => {
          const parent = element.closest('[data-slot="top-bar-section"]')!
          const control = element.getBoundingClientRect()
          const viewport = parent.getBoundingClientRect()
          return control.left >= viewport.left - 1 && control.right <= viewport.right + 1
        })
        expect(visible).toBe(true)
        await page.keyboard.press('Enter')
        await expect(page.locator('output')).toHaveText((await button.getAttribute('aria-label'))!)
      }
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
