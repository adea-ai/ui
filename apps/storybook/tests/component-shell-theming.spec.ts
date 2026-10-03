import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { expect, test, type Page } from '@playwright/test'

let script: string
let css: string

test.beforeAll(async () => {
  const root = resolve(import.meta.dirname, '../../../packages/ui')
  const result = await build({
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      target: 'esnext',
      lib: {
        entry: resolve(root, 'tests/fixtures/shell-theming.tsx'),
        formats: ['iife'],
        name: 'ShellThemingFixture',
      },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
  script = outputs
    .filter((output) => output.type === 'chunk')
    .map((output) => output.code)
    .join('\n')
  css = outputs
    .flatMap((output) =>
      output.type === 'asset' && output.fileName.endsWith('.css') ? [String(output.source)] : []
    )
    .join('\n')
})

async function mount(page: Page, options: { blockStorage?: boolean } = {}) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Shell theming</title></head><body></body></html>'
  )
  if (options.blockStorage) {
    // What a sandboxed iframe or a privacy mode does: the global exists, and
    // touching it — even through `typeof` — throws.
    await page.evaluate(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Access is denied for this document.', 'SecurityError')
        },
      })
    })
  }
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
}

/** Distance from an element's inline-start edge to where its text starts. */
function textInset(page: Page, testId: string, selector: string) {
  return page
    .getByTestId(testId)
    .locator(selector)
    .first()
    .evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect().left - element.getBoundingClientRect().left
    })
}

test('ThemeProvider mounts and switches in memory where storage access throws', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mount(page, { blockStorage: true })

  await expect(page.getByTestId('appearance')).toHaveText('system')
  await page.getByRole('button', { name: 'Use dark' }).click()
  await expect(page.getByTestId('appearance')).toHaveText('dark')
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  expect(errors).toEqual([])
})

test('ThemePicker options size to their previews and keep wrapped rows aligned', async ({
  page,
}) => {
  await mount(page)
  const options = page.getByTestId('picker-host').getByRole('radio')
  const count = await options.count()
  expect(count).toBeGreaterThan(5)

  const metrics = await options.evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect()
      const preview = button.querySelector('[data-slot="theme-preview"]')!.getBoundingClientRect()
      return {
        top: Math.round(box.top),
        height: box.height,
        width: box.width,
        previewTop: preview.top,
        previewHeight: preview.height,
        previewWidth: preview.width,
      }
    })
  )

  for (const option of metrics) {
    // `h-auto` beats the `sm` control height: the preview (96px plus its 1px
    // borders) is not squashed into a 28px button.
    expect(option.previewHeight).toBeCloseTo(98, 0)
    expect(option.height).toBeGreaterThan(option.previewHeight)
    // `p-0` beats the `sm` side padding: the option is exactly its preview's width.
    expect(option.width).toBeCloseTo(option.previewWidth, 0)
  }

  // 960px of host holds five 176px previews with their 12px gaps.
  const firstRowTop = metrics[0]!.top
  expect(metrics.filter((option) => option.top === firstRowTop)).toHaveLength(5)

  // A second label line on some options must not push the others' previews down.
  const rows = new Map<number, number[]>()
  for (const option of metrics)
    rows.set(option.top, [...(rows.get(option.top) ?? []), option.previewTop])
  for (const previewTops of rows.values()) {
    for (const top of previewTops) expect(top).toBeCloseTo(previewTops[0]!, 0)
  }
})

test('SideRailItem badge trails the label expanded and sits on the icon corner collapsed', async ({
  page,
}) => {
  await mount(page)

  const expandedRow = (await page.getByTestId('expanded-row').boundingBox())!
  const expandedIcon = (await page.getByTestId('expanded-icon').boundingBox())!
  const expandedBadge = (await page
    .getByTestId('expanded-row')
    .locator('[data-slot="side-rail-badge"]')
    .boundingBox())!
  const label = (await page
    .getByTestId('expanded-row')
    .getByText('App library', { exact: true })
    .boundingBox())!
  // Clear of the glyph, after the label, and at the row's trailing end.
  expect(expandedBadge.x).toBeGreaterThanOrEqual(expandedIcon.x + expandedIcon.width)
  expect(expandedBadge.x).toBeGreaterThanOrEqual(label.x + label.width - 1)
  expect(expandedRow.x + expandedRow.width - (expandedBadge.x + expandedBadge.width)).toBeLessThan(
    16
  )

  const collapsedRow = (await page.getByTestId('collapsed-row').boundingBox())!
  const collapsedIcon = (await page.getByTestId('collapsed-icon').boundingBox())!
  const collapsedBadge = (await page
    .getByTestId('collapsed-row')
    .locator('[data-slot="side-rail-badge"]')
    .boundingBox())!
  // Over the icon's top-end corner, and still inside the row.
  const iconTopEnd = { x: collapsedIcon.x + collapsedIcon.width, y: collapsedIcon.y }
  expect(collapsedBadge.x).toBeLessThan(iconTopEnd.x)
  expect(collapsedBadge.x + collapsedBadge.width).toBeGreaterThan(iconTopEnd.x)
  expect(collapsedBadge.y).toBeLessThan(iconTopEnd.y)
  expect(collapsedBadge.y + collapsedBadge.height).toBeGreaterThan(iconTopEnd.y)
  expect(collapsedBadge.x + collapsedBadge.width).toBeLessThanOrEqual(
    collapsedRow.x + collapsedRow.width
  )
})

test('button-rendered rail rows and section headers start-align their labels', async ({ page }) => {
  await mount(page)
  expect(await textInset(page, 'expanded-row', 'span.truncate')).toBeLessThan(1)
  expect(await textInset(page, 'section-host', 'button span.truncate')).toBeLessThan(1)
})
