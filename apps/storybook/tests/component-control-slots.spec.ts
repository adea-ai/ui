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
          '../../../packages/ui/tests/fixtures/control-slots.tsx'
        ),
        formats: ['iife'],
        name: 'ControlSlotsFixture',
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
  await page.setViewportSize({ width: 800, height: 1600 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Control slots</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('every control root in the DOM carries its data-slot', async ({ page }) => {
  const roots = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>('[data-probe]')].map((probe) => {
        // Select's root renders Kobalte's hidden native select first; the
        // trigger is the control a consumer styles, and it is a button.
        const root =
          probe.dataset['probe'] === 'select-trigger'
            ? probe.querySelector('button')
            : probe.firstElementChild
        return [probe.dataset['probe'], root?.getAttribute('data-slot') ?? null]
      })
    )
  )
  expect(roots).toEqual({
    button: 'button',
    'action-button': 'action-button',
    badge: 'badge',
    'status-chip': 'status-chip',
    checkbox: 'checkbox',
    switch: 'switch',
    toggle: 'toggle',
    'toggle-group': 'toggle-group',
    'radio-group': 'radio-group',
    'select-trigger': 'select-trigger',
    'entity-icon': 'entity-icon',
    'list-row': 'list-row',
    slider: 'slider',
    progress: 'progress',
    tabs: 'tabs',
    'native-select-sm': 'native-select-wrapper',
    'input-group-sm': 'input-group',
  })
  for (const slot of ['toggle-group-item', 'radio-group-item', 'tabs-list', 'tabs-trigger'])
    await expect(page.locator(`[data-slot="${slot}"]`).first()).toBeAttached()
})

test('small selects and input groups sit on the sm control rung', async ({ page }) => {
  const heights = await page.evaluate(() => ({
    select: document
      .querySelector('[data-probe="native-select-sm"] select')!
      .getBoundingClientRect().height,
    group: document.querySelector('[data-probe="input-group-sm"] > *')!.getBoundingClientRect()
      .height,
    sm: parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--control-height-sm')
    ),
    root: parseFloat(getComputedStyle(document.documentElement).fontSize),
  }))
  expect(heights.select).toBe(heights.sm * heights.root)
  expect(heights.group).toBe(heights.sm * heights.root)
})

test('a small card tightens its parts with it', async ({ page }) => {
  const padding = await page.evaluate(() =>
    Object.fromEntries(
      ['card-default', 'card-sm'].map((id) => {
        const card = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
        const content = card.querySelector<HTMLElement>('[data-slot="card-content"]')!
        const header = card.querySelector<HTMLElement>('[data-slot="card-header"]')!
        return [
          id,
          {
            block: getComputedStyle(card).paddingTop,
            content: getComputedStyle(content).paddingInlineStart,
            header: getComputedStyle(header).paddingInlineStart,
          },
        ]
      })
    )
  )
  expect(padding['card-default']).toEqual({ block: '16px', content: '16px', header: '16px' })
  expect(padding['card-sm']).toEqual({ block: '12px', content: '12px', header: '12px' })
})

test('fill and scrollable tab lists span the pane, and the scroller does not clip the mark', async ({
  page,
}) => {
  const geometry = await page.evaluate(() =>
    Object.fromEntries(
      ['tabs-fill', 'tabs-scrollable', 'tabs-default'].map((id) => {
        const container = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
        const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]')!
        const selected = list.querySelector<HTMLElement>('[data-selected]')!
        return [
          id.replace('tabs-', ''),
          {
            container: container.getBoundingClientRect().width,
            list: list.getBoundingClientRect().width,
            listBottom: list.getBoundingClientRect().bottom,
            markBottom: selected.getBoundingClientRect().bottom,
            scrollWidth: list.scrollWidth,
            clientWidth: list.clientWidth,
            scrollHeight: list.scrollHeight,
            clientHeight: list.clientHeight,
          },
        ]
      })
    )
  )
  expect(geometry['fill']!.list).toBe(geometry['fill']!.container)
  expect(geometry['default']!.list).toBeLessThan(geometry['default']!.container)
  expect(geometry['scrollable']!.list).toBe(geometry['scrollable']!.container)
  expect(geometry['scrollable']!.scrollWidth).toBeGreaterThan(geometry['scrollable']!.clientWidth)
  expect(geometry['scrollable']!.scrollHeight).toBe(geometry['scrollable']!.clientHeight)
  // The selected mark ends on the rule's bottom edge, as it does on a bordered list.
  expect(geometry['scrollable']!.markBottom).toBe(geometry['scrollable']!.listBottom)
  expect(geometry['default']!.markBottom).toBe(geometry['default']!.listBottom)
})
