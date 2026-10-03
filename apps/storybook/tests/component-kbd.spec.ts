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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/kbd-geometry.tsx'),
        formats: ['iife'],
        name: 'KbdFixture',
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

test('compact drops one height rung and the default cap is unchanged', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Kbd geometry</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const scale = await page.evaluate(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16
  )
  const caps = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-cap]')].map((element) => {
      const style = getComputedStyle(element)
      return {
        cap: element.dataset['cap']!,
        height: parseFloat(style.height),
        padding: parseFloat(style.paddingInlineStart),
        background: style.backgroundColor,
      }
    })
  )

  // 20px is the default rung the cap has always had; 16px is compact.
  expect(caps).toEqual([
    { cap: 'default', height: 20 * scale, padding: 4 * scale, background: caps[0]!.background },
    { cap: 'compact', height: 16 * scale, padding: 2 * scale, background: caps[1]!.background },
  ])
  // The compact fill is the 40% tint, so the two backgrounds must differ —
  // that is the lightened cap dense rows are owed.
  expect(caps[1]!.background).not.toBe(caps[0]!.background)
})

test('the group gap tightens with the compact caps', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Kbd geometry</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const scale = await page.evaluate(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16
  )
  const gaps = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-group]')].map((element) => ({
      group: element.dataset['group']!,
      gap: parseFloat(getComputedStyle(element).columnGap),
      capHeight: parseFloat(getComputedStyle(element.firstElementChild as Element).height),
    }))
  )

  expect(gaps).toEqual([
    { group: 'default', gap: 4 * scale, capHeight: 20 * scale },
    { group: 'compact', gap: 2 * scale, capHeight: 16 * scale },
  ])
})

test('a chord draws one cap per character and stays out of the host name', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Kbd geometry</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  // "⇧⌘P" is three drawn characters, so it is three caps at either size.
  for (const size of ['default', 'compact'] as const) {
    const chord = page.locator(`[data-chord="${size}"]`)
    await expect(chord).toHaveAttribute('aria-hidden', 'true')
    const capCount = await chord.locator('[data-slot="kbd"]').count()
    expect(capCount, `${size} chord draws one cap per character`).toBe(3)
    const capHeight = await chord
      .locator('[data-slot="kbd"]')
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).height))
    expect(capHeight).toBe(size === 'compact' ? 16 : 20)
  }

  // The decoration contract: the chord inside the host is invisible to the
  // accessible name, and the parseable shortcut stays on the control.
  const host = page.getByRole('button', { name: 'Search projects', exact: true })
  await expect(host).toHaveCount(1)
  await expect(host).toHaveAttribute('aria-keyshortcuts', 'Meta+K')
  await expect(host.locator('[data-slot="kbd"]')).toHaveCount(2)
})
