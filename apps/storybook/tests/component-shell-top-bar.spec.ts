import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
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
          '../../../packages/ui/tests/fixtures/shell-top-bar.tsx'
        ),
        formats: ['iife'],
        name: 'ShellTopBarFixture',
      },
    },
  })
  const assets = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
  script = assets.flatMap((asset) => (asset.type === 'chunk' ? [asset.code] : [])).join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test('the shell top bar stays inside its window and keeps every control reachable at 320px and 200% text', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Shell top bar</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const bar = page.locator('[data-slot="shell-top-bar"]')
  await expect(bar).toBeVisible()
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const factor of [1, 2]) {
      const where = `${width}px at ${factor * 100}% text`
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${16 * scale}px`
      }, factor)
      // Measure the settled layout: the first frame after a resize can be transient.
      await expect
        .poll(
          () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          { message: `${where}: the page must not scroll sideways` }
        )
        .toBe(true)
      const measured = await bar.evaluate((header) => {
        const box = header.getBoundingClientRect()
        const leading = header.querySelector<HTMLElement>('[data-slot="shell-top-bar-leading"]')!
        const controls = [...header.querySelectorAll<HTMLElement>('button, [role="button"]')]
        return {
          viewport: window.innerWidth,
          left: box.left,
          right: box.right,
          height: box.height,
          leadingScrolls: leading.scrollWidth > leading.clientWidth + 1,
          leadingRight: leading.getBoundingClientRect().right,
          top: box.top,
          bottom: box.bottom,
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
          divider: (() => {
            const rect = header
              .querySelector<HTMLElement>('[data-slot="shell-top-bar-divider"]')!
              .getBoundingClientRect()
            return { height: rect.height, top: rect.top, bottom: rect.bottom }
          })(),
          controls: controls.map((control) => {
            const rect = control.getBoundingClientRect()
            return {
              name: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '',
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              bottom: rect.bottom,
            }
          }),
        }
      })
      expect(measured.right, `${where}: the bar fits the window`).toBeLessThanOrEqual(
        measured.viewport + 1
      )
      expect(measured.leadingRight, `${where}: the leading half fits the bar`).toBeLessThanOrEqual(
        measured.right + 1
      )
      expect(measured.leadingScrolls, `${where}: the leading controls are not cut off`).toBe(false)
      expect(
        measured.controls.length,
        `${where}: every control is rendered`
      ).toBeGreaterThanOrEqual(7)
      // The divider is a fixed 1.25rem mark. Its own vertical-orientation `h-full` once won over a
      // plain `h-5`, so it took a height from the wrapped bar (or none at all) instead.
      expect(
        Math.abs(measured.divider.height - 1.25 * measured.rem),
        `${where}: the divider is 1.25rem tall`
      ).toBeLessThanOrEqual(1)
      expect(
        measured.divider.top,
        `${where}: the divider starts inside the bar`
      ).toBeGreaterThanOrEqual(measured.top - 1)
      expect(
        measured.divider.bottom,
        `${where}: the divider ends inside the bar`
      ).toBeLessThanOrEqual(measured.bottom + 1)
      for (const control of measured.controls) {
        expect(
          control.bottom,
          `${where}: ${control.name} ends inside the bar, not below it`
        ).toBeLessThanOrEqual(measured.bottom)
        expect(
          control.height,
          `${where}: ${control.name} keeps a 24px target height`
        ).toBeGreaterThanOrEqual(24)
        expect(
          control.left,
          `${where}: ${control.name} starts inside the window`
        ).toBeGreaterThanOrEqual(measured.left - 1)
        expect(
          control.right,
          `${where}: ${control.name} ends inside the window`
        ).toBeLessThanOrEqual(measured.viewport + 1)
        expect(
          control.width,
          `${where}: ${control.name} keeps a usable target`
        ).toBeGreaterThanOrEqual(24)
      }
    }
  }
  // Wrapping must stay accessible: nothing hidden, labelled, and operable by keyboard.
  const results = await new AxeBuilder({ page }).include('[data-slot="shell-top-bar"]').analyze()
  expect(results.violations).toEqual([])
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  expect(first).toBe('Back')
})
