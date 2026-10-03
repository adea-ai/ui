import { expect, test, type Locator, type Page } from '@playwright/test'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/calendar.tsx'),
        formats: ['iife'],
        name: 'CalendarFixture',
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
    '<!doctype html><html lang="en"><head><title>Calendar</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

/** The resolved `--primary` fill, read from a probe so the comparison is engine-normalised. */
async function primaryFill(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'bg-primary'
    document.body.append(probe)
    const fill = getComputedStyle(probe).backgroundColor
    probe.remove()
    return fill
  })
}

function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

function day(scope: Locator, name: string): Locator {
  // The visible number is aria-hidden, so the trigger's text ends with the full date.
  return scope.locator('[data-corvu-calendar-celltrigger]', { hasText: new RegExp(`${name}$`) })
}

test('fills the selected day and both ends of a range', async ({ page }) => {
  const primary = await primaryFill(page)
  const single = page.getByTestId('calendar-single')
  const range = page.getByTestId('calendar-range')

  // corvu marks state with an empty attribute (`data-selected=""`), not `"true"`.
  await expect(day(single, 'September 25, 2026')).toHaveAttribute('data-selected', '')
  expect(await background(day(single, 'September 25, 2026'))).toBe(primary)
  expect(await background(day(single, 'September 24, 2026'))).not.toBe(primary)

  expect(await background(day(range, 'September 10, 2026'))).toBe(primary)
  expect(await background(day(range, 'September 18, 2026'))).toBe(primary)
  expect(await background(day(range, 'September 20, 2026'))).not.toBe(primary)

  // Between the ends the fill is subtle, so the label must not stay on-primary.
  const middle = day(range, 'September 14, 2026')
  const end = day(range, 'September 10, 2026')
  expect(await background(middle)).not.toBe(primary)
  expect(await background(middle)).not.toBe('rgba(0, 0, 0, 0)')
  expect(await middle.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    await end.evaluate((element) => getComputedStyle(element).color)
  )
})
