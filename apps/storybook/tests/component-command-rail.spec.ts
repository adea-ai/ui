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
          '../../../packages/ui/tests/fixtures/command-rail-states.tsx'
        ),
        formats: ['iife'],
        name: 'CommandRailStatesFixture',
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
  await page.setContent('<!doctype html><html lang="en"><body></body></html>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('disabled menu text stays legible and selected shortcuts follow their row in Nord', async ({
  page,
}) => {
  const input = page.getByRole('combobox', { name: 'Filter commands' })
  await input.focus()
  await input.fill('Open settings')
  await input.press('ArrowDown')

  const item = page.locator('[cmdk-item][data-selected="true"]')
  await expect(item).toContainText('Open settings')
  const selected = await item.evaluate((element) => {
    const shortcut = element.querySelector('span')
    if (!shortcut) throw new Error('The selected command has no shortcut')
    const style = getComputedStyle(element)
    const theme = element.closest<HTMLElement>('[data-theme-id]')
    if (!theme) throw new Error('The command item lost its theme scope')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is unavailable for token comparison')
    const color = (value: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data.slice(0, 3).join(',')
    }
    return {
      row: style.color,
      fill: color(style.backgroundColor),
      shortcut: getComputedStyle(shortcut).color,
      expectedRow: getComputedStyle(theme).getPropertyValue('--foreground').trim(),
      expectedFill: color(getComputedStyle(theme).getPropertyValue('--card').trim()),
    }
  })
  expect(selected.shortcut).toBe(selected.row)
  expect(selected.row).toBe(selected.expectedRow)
  expect(selected.fill).toBe(selected.expectedFill)

  await input.fill('Switch project')
  const enabled = page.getByRole('option', { name: 'Switch project' })
  const enabledStyle = await enabled.evaluate((element) => {
    const style = getComputedStyle(element)
    const theme = element.closest<HTMLElement>('[data-theme-id]')
    if (!theme) throw new Error('The command item lost its theme scope')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is unavailable for token comparison')
    const color = (value: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data.slice(0, 3).join(',')
    }
    return {
      opacity: style.opacity,
      color: color(style.color),
      expected: color(getComputedStyle(theme).getPropertyValue('--popover-foreground').trim()),
    }
  })
  expect(enabledStyle.opacity).toBe('1')
  expect(enabledStyle.color).toBe(enabledStyle.expected)

  const disabled = page.getByRole('option', { name: 'Restricted action' })
  await expect(disabled).toHaveAttribute('data-disabled')
  const disabledStyle = await disabled.evaluate((element) => {
    const style = getComputedStyle(element)
    const theme = element.closest<HTMLElement>('[data-theme-id]')
    if (!theme) throw new Error('The command item lost its theme scope')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is unavailable for token comparison')
    context.fillStyle = style.color
    context.fillRect(0, 0, 1, 1)
    const color = context.getImageData(0, 0, 1, 1).data.slice(0, 3).join(',')
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = getComputedStyle(theme).getPropertyValue('--muted-foreground').trim()
    context.fillRect(0, 0, 1, 1)
    const muted = context.getImageData(0, 0, 1, 1).data.slice(0, 3).join(',')
    return {
      color,
      muted,
      opacity: style.opacity,
    }
  })
  expect(disabledStyle.opacity).toBe('1')
  expect(disabledStyle.color).toBe(disabledStyle.muted)
})

test('SideRailButton applies the shared active state and data marker', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Utilities' })
  await expect(button).toHaveAttribute('data-active', 'true')
  const colors = await button.evaluate((element) => {
    const style = getComputedStyle(element)
    const theme = element.closest<HTMLElement>('[data-theme-id]')
    if (!theme) throw new Error('The rail button lost its theme scope')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas is unavailable for token comparison')
    const color = (value: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data.slice(0, 3).join(',')
    }
    return {
      background: color(style.backgroundColor),
      activeBackground: color(getComputedStyle(theme).getPropertyValue('--sidebar-accent').trim()),
      foreground: color(style.color),
      activeForeground: color(
        getComputedStyle(theme).getPropertyValue('--sidebar-accent-foreground').trim()
      ),
    }
  })
  expect(colors.background).toBe(colors.activeBackground)
  expect(colors.foreground).toBe(colors.activeForeground)
})

test('compact StatusChip keeps its label available and hides its decorative dot', async ({
  page,
}) => {
  const label = page.getByText('Source healthy', { exact: true })
  await expect(label).toHaveClass(/sr-only/)
  const chip = label.locator('..')
  await expect(chip.locator('[aria-hidden="true"]')).toHaveCount(1)
})
