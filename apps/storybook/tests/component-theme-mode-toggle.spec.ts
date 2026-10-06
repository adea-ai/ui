import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

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
        entry: resolve(root, 'tests/fixtures/theme-mode-toggle.tsx'),
        formats: ['iife'],
        name: 'ModeFixture',
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
test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Mode selector</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('controlled mode selection owns roving focus and explanatory tooltips without a provider', async ({
  page,
}) => {
  const group = page.getByRole('group', { name: 'Appearance', exact: true })
  const system = group.getByRole('button', { name: 'System', exact: true })
  const light = group.getByRole('button', { name: 'Light', exact: true })
  // Tab into the group: keyboard intent announces the tooltip (a programmatic
  // focus() is exactly what the tooltip focus gate keeps quiet).
  await page.keyboard.press('Tab')
  await expect(system).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Use system appearance')
  await system.press('ArrowRight')
  await expect(light).toBeFocused()
  await light.press('Space')
  await expect(page.getByTestId('mode')).toHaveText('light')
  await expect(light).toHaveAttribute('aria-pressed', 'true')
  await light.press('Space')
  await expect(page.getByTestId('mode')).toHaveText('light')
  await group.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.getByTestId('mode')).toHaveText('dark')
})

test('Escape on a focused item stays unhandled for an enclosing dismissible layer', async ({
  page,
}) => {
  const group = page.getByRole('group', { name: 'Appearance', exact: true })
  const system = group.getByRole('button', { name: 'System', exact: true })
  await system.focus()
  await system.press('Escape')
  await expect(page.getByTestId('escape')).toHaveText('pass-through')
  await expect(page.getByTestId('mode')).toHaveText('system')
})

test('disabled selection and enlarged narrow layout remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  const disabled = page.getByRole('group', { name: 'Disabled appearance' })
  for (const button of await disabled.getByRole('button').all()) await expect(button).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
