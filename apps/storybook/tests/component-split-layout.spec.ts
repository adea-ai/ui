import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/split-layout.tsx'),
        formats: ['iife'],
        name: 'SplitLayoutFixture',
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
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Layout</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

async function act(page: import('@playwright/test').Page, detail: string) {
  await page.evaluate(
    (value) => window.dispatchEvent(new CustomEvent('layout-fixture', { detail: value })),
    detail
  )
}
test('split, resize and cross-parent move preserve the editor owner, DOM, value and caret', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Editor a' })
  await field.fill('Unsent editor text')
  await field.focus()
  await field.evaluate((el) => {
    ;(el as HTMLTextAreaElement).setSelectionRange(3, 9, 'backward')
    el.setAttribute('data-retained', 'yes')
  })
  await act(page, 'split')
  await act(page, 'nested')
  await act(page, 'resize')
  await act(page, 'move')
  await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('3')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
  await expect(field).toHaveAttribute('data-retained', 'yes')
  await expect(field).toHaveValue('Unsent editor text')
  await expect(field).toBeFocused()
  expect(
    await field.evaluate((el) => [
      (el as HTMLTextAreaElement).selectionStart,
      (el as HTMLTextAreaElement).selectionEnd,
      (el as HTMLTextAreaElement).selectionDirection,
    ])
  ).toEqual([3, 9, 'backward'])
})
test('physical separator orientation, controls and constrained keyboard resizing agree', async ({
  page,
}) => {
  await act(page, 'split')
  await act(page, 'nested')
  const handles = page.getByRole('separator')
  await expect(handles).toHaveCount(2)
  const row = page.getByRole('separator', { name: 'Resize pane columns' })
  const column = page.getByRole('separator', { name: 'Resize pane rows' })
  await expect(row).toHaveAttribute('aria-orientation', 'vertical')
  await expect(column).toHaveAttribute('aria-orientation', 'horizontal')
  await row.focus()
  await row.press('ArrowRight')
  await expect(row).toHaveAttribute('aria-valuenow', '55')
  for (let i = 0; i < 15; i++) await row.press('ArrowRight')
  await expect(row).toHaveAttribute('aria-valuenow', '90')
  await expect(row).toHaveAttribute('aria-valuemin', '10')
  await expect(row).toHaveAttribute('aria-valuemax', '90')
  const ids = (await row.getAttribute('aria-controls'))!.split(' ')
  expect(ids.length).toBe(3)
  for (const id of ids) await expect(page.locator(`[id="${id}"]`)).toHaveAttribute('role', 'region')
  await column.focus()
  await column.press('ArrowDown')
  await expect(column).toHaveAttribute('aria-valuenow', '55')
})
test('closing focuses the host-selected survivor and removes only the closed owner', async ({
  page,
}) => {
  await act(page, 'split')
  await page.getByRole('button', { name: 'Close Pane b' }).click()
  await expect(page.getByLabel('Unmounts')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Pane a' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Editor b' })).toHaveCount(0)
})

test('automated accessibility covers nested labelled panes in light and dark', async ({ page }) => {
  await act(page, 'split')
  await act(page, 'nested')
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
})
test('pointer resize changes physical pane geometry and keeps editors alive', async ({ page }) => {
  await act(page, 'split')
  const handle = page.getByRole('separator', { name: 'Resize pane columns' })
  const box = (await handle.boundingBox())!
  const pane = page.getByRole('region', { name: 'Pane a' })
  const before = (await pane.boundingBox())!.width
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  expect((await pane.boundingBox())!.width).toBeGreaterThan(before + 80)
  await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('2')
  await expect(page.getByLabel('Unmounts')).toHaveText('0')
})

test('a pane move never steals newer focus from another layout instance', async ({ page }) => {
  await act(page, 'split')
  await page.getByRole('textbox', { name: 'Editor a' }).focus()
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('layout-fixture', { detail: 'move' }))
    ;(document.querySelector('[aria-label="Other editor"]') as HTMLInputElement).focus()
  })
  await expect(page.getByRole('textbox', { name: 'Other editor' })).toBeFocused()
  const ids = await page
    .locator('[data-pane-id="a"]')
    .evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(new Set(ids).size).toBe(2)
})
test('unmount cancels pending focus work and disposes every removed leaf owner', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await act(page, 'split')
  await page.getByRole('textbox', { name: 'Editor a' }).focus()
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('layout-fixture', { detail: 'move' }))
    window.dispatchEvent(new CustomEvent('layout-fixture', { detail: 'unmount' }))
    ;(document.querySelector('[aria-label="Other editor"]') as HTMLInputElement).focus()
  })
  await expect(page.getByLabel('Unmounts')).toHaveText('2')
  await expect(page.getByRole('textbox', { name: 'Other editor' })).toBeFocused()
  expect(errors).toEqual([])
})
test('fractional pane geometry survives CSP that blocks inline style attributes', async ({
  page,
}) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(message.text())
  })
  expect(script).not.toContain('</script')
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-layout-fixture'; style-src 'nonce-layout-fixture'; style-src-attr 'none'"><title>CSP layout</title><style nonce="layout-fixture">${css}</style></head><body><script nonce="layout-fixture">${script}</script></body></html>`
  )
  await act(page, 'split')
  const a = (await page.getByRole('region', { name: 'Pane a' }).boundingBox())!
  const b = (await page.getByRole('region', { name: 'Pane b' }).boundingBox())!
  expect(a.width).toBeGreaterThan(100)
  expect(Math.abs(a.width - b.width)).toBeLessThan(2)
  expect(b.x).toBeGreaterThan(a.x + 100)
  expect(violations).toEqual([])
})

test('clean native Node renders nested pane regions without browser globals', async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid({ ssr: true })],
    ssr: { noExternal: true },
    build: {
      write: false,
      minify: false,
      ssr: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/split-layout-ssr.tsx'),
    },
  })
  const chunks = (Array.isArray(result) ? result : [result])
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((asset) => asset.type === 'chunk')
  expect(chunks).toHaveLength(1)
  const directory = await mkdtemp(resolve(tmpdir(), 'adea-split-layout-ssr-'))
  try {
    const chunk = chunks[0]
    if (!chunk) throw new Error('Missing SSR chunk')
    await writeFile(resolve(directory, 'fixture.mjs'), chunk.code)
    await writeFile(
      resolve(directory, 'render.mjs'),
      "import { renderLayout } from './fixture.mjs'; process.stdout.write(renderLayout());"
    )
    const markup = execFileSync(process.execPath, [resolve(directory, 'render.mjs')], {
      encoding: 'utf8',
    })
    expect(markup).toContain('aria-label="Server panes"')
    expect(markup.match(/role="region"/g)).toHaveLength(2)
    expect(markup).toContain('aria-orientation="vertical"')
    expect(markup).toContain('aria-valuenow="50"')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

for (const width of [320, 1440])
  for (const theme of ['light', 'dark']) {
    test(`eight pane geometry ${theme} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 800 })
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        theme === 'dark'
      )
      await act(page, 'split')
      await act(page, 'eight')
      const layout = page.getByRole('group', { name: 'Work panes', exact: true })
      await expect(layout.getByRole('region')).toHaveCount(8)
      await expect(layout.getByRole('separator')).toHaveCount(7)
      await expect(page.getByLabel('Mounts', { exact: true })).toHaveText('8')
      await expect(page.getByLabel('Unmounts')).toHaveText('0')
      for (const pane of await layout.getByRole('region').all()) {
        const box = (await pane.boundingBox())!
        expect(box.width).toBeGreaterThan(50)
        expect(box.height).toBeGreaterThan(100)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      await layout.screenshot({ path: testInfo.outputPath(`split-${theme}-${width}.png`) })
    })
  }
