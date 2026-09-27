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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/input-aria.tsx'),
        formats: ['iife'],
        name: 'InputAriaFixture',
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
test('native inputs retain names, help, validation and keyboard behavior', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Input accessibility</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const checkbox = page.getByRole('checkbox', { name: 'Sync workspace', exact: true })
  const toggle = page.getByRole('switch', { name: 'Enable source', exact: true })
  const radio = page.getByRole('radio', { name: 'Files and code', exact: true })
  for (const input of [checkbox, toggle, radio]) {
    await expect(input).toHaveAccessibleDescription('Choose which workspace to sync.')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAttribute('aria-busy', 'true')
  }
  await expect(checkbox).toHaveAttribute('title', 'Workspace sync')
  await expect(toggle).toHaveAttribute('title', 'Source availability')
  await expect(radio).toHaveAttribute('title', 'File provider')
  for (const [input, title] of [
    [checkbox, 'Workspace sync'],
    [toggle, 'Source availability'],
    [radio, 'File provider'],
  ] as const) {
    const visibleRow = input.locator('..')
    await expect(visibleRow).toBeVisible()
    await expect(visibleRow).toHaveAttribute('title', title)
  }
  await expect(page.getByRole('checkbox', { name: 'Work', exact: true })).toHaveCount(1)
  await expect(
    page.getByRole('radio', { name: 'Calendar', exact: true })
  ).toHaveAccessibleDescription('Events in your calendar')
  await expect(
    page.getByRole('checkbox', { name: 'Include attachments', exact: true })
  ).toHaveAccessibleDescription('Screenshots and files')
  await expect(
    page.getByRole('switch', { name: 'Notify team', exact: true })
  ).toHaveAccessibleDescription('Deliver updates immediately')
  await expect(
    page.getByRole('checkbox', { name: 'Composed option', exact: true })
  ).toHaveAccessibleDescription('Composed help')
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).toBeChecked()
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toBeChecked()
  await radio.focus()
  await page.keyboard.press('Space')
  await expect(radio).toBeChecked()
  await page.getByRole('button', { name: 'Clear validation' }).click()
  for (const input of [checkbox, toggle, radio]) {
    await expect(input).toHaveAttribute('aria-invalid', 'false')
    await expect(input).toHaveAttribute('aria-busy', 'false')
  }
})
