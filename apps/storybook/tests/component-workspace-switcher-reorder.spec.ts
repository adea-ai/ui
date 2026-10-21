import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

const uiRoot = resolve(import.meta.dirname, '../../../packages/ui')
const fixture = resolve(uiRoot, 'tests/fixtures/workspace-switcher-reorder.tsx')

let script: string
let css: string

test.beforeAll(async () => {
  const result = await build({
    root: uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: { entry: fixture, formats: ['iife'], name: 'WorkspaceSwitcherReorderFixture' },
      // One script for the blank page; the split itself is checked below.
      rollupOptions: { output: { inlineDynamicImports: true } },
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

test('the reorder dialog is its own chunk, not part of the switcher', async () => {
  const result = await build({
    root: uiRoot,
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: fixture },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const chunks = outputs
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((asset) => asset.type === 'chunk')
  const dialog = chunks.filter((chunk) => chunk.code.includes('Workspace order'))
  const entry = chunks.filter((chunk) => chunk.isEntry)

  expect(dialog).toHaveLength(1)
  expect(dialog[0]?.isEntry).toBe(false)
  expect(dialog[0]?.isDynamicEntry).toBe(true)
  for (const chunk of entry) expect(chunk.code).not.toContain('Workspace order')
  // The switcher itself still ships in the entry.
  expect(entry.some((chunk) => chunk.code.includes('Workspaces'))).toBe(true)
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Workspace switcher reorder</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('choosing Reorder workspaces opens the dialog, saves a move and returns focus to the trigger', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: /Switch workspace/ })
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Reorder workspaces…' }).click()

  const dialog = page.getByRole('dialog', { name: 'Reorder workspaces' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Move cortana up', exact: true }).click()
  await expect(page.getByLabel('Order', { exact: true })).toHaveText('home,cortana,adea')
  await expect(dialog.getByRole('status')).toHaveText('Moved cortana to position 2 of 3.')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  // Reopening after the first load works the same.
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Reorder workspaces…' }).click()
  await expect(page.getByRole('dialog', { name: 'Reorder workspaces' })).toBeVisible()
})
