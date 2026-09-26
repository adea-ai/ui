import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

let script: string
let css: string

test('the composed editor server-renders without a browser or application globals', async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid({ ssr: true })],
    ssr: { noExternal: true },
    build: {
      write: false,
      minify: false,
      ssr: resolve(
        import.meta.dirname,
        '../../../packages/ui/tests/fixtures/appearance-editor-ssr.tsx'
      ),
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const chunks = outputs
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((asset) => asset.type === 'chunk')
  expect(chunks).toHaveLength(1)
  const directory = await mkdtemp(resolve(tmpdir(), 'adea-appearance-ssr-'))
  try {
    await writeFile(resolve(directory, 'fixture.mjs'), chunks[0]!.code)
    await writeFile(
      resolve(directory, 'render.mjs'),
      "import { renderAppearance } from './fixture.mjs'; process.stdout.write(renderAppearance());"
    )
    const html = execFileSync(process.execPath, [resolve(directory, 'render.mjs')], {
      encoding: 'utf8',
    })
    expect(html).toContain('data-appearance-editor')
    expect(html).toContain('Appearance mode')
    expect(html).toContain('Light theme')
    expect(html).toContain('Dark theme')
    expect(html).toContain("Uses the palette's intended color.")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

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
          '../../../packages/ui/tests/fixtures/appearance-editor.tsx'
        ),
        formats: ['iife'],
        name: 'AppearanceFixture',
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
    '<!doctype html><html lang="en"><head><title>Appearance fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await page.getByRole('button', { name: 'Appearance settings' }).click()
})

test('mode previews and both theme rows remain available through keyboard changes', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: /^Light theme/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeVisible()
  await expect(page.locator('[data-mode="system"] [data-theme-miniature]')).toHaveCount(2)
  await expect(
    page.getByRole('radiogroup', { name: 'Appearance mode' }).getByRole('radio')
  ).toHaveCount(3)
  const system = page.getByRole('radio', { name: 'System', exact: true })
  await system.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeVisible()
  await expect(page.getByText('Typeface', { exact: true })).toHaveCount(0)
})

test('donor helper copy distinguishes palette defaults and explicit overrides', async ({
  page,
}) => {
  await expect(
    page.getByText("Theme default · Uses the palette's intended color.", { exact: true })
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Blue', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByText('Blue · Controls, glyphs, selections, code, and activity.', { exact: true })
  ).toBeVisible()
  await page.getByText('Opaque', { exact: true }).click()
  await expect(page.getByText('Solid surfaces for every theme.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Light theme/ }).click()
  await expect(page.getByRole('option', { name: 'Catppuccin Latte', exact: true })).toBeVisible()
})

test('unsaved theme selection updates live miniatures and Cancel restores the snapshot', async ({
  page,
}) => {
  const preview = page.locator('[data-live-preview]')
  const initial = await preview.evaluate((element) => getComputedStyle(element).color)
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  const menuAccessibility = await new AxeBuilder({ page }).analyze()
  expect(
    menuAccessibility.violations.filter((finding) =>
      ['serious', 'critical'].includes(finding.impact ?? '')
    )
  ).toEqual([])
  await page.getByRole('option', { name: 'Dracula', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Dracula')
  await expect
    .poll(() => preview.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(initial)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect
    .poll(() => preview.evaluate((element) => getComputedStyle(element).color))
    .toBe(initial)
  await expect(page.getByRole('button', { name: 'Appearance settings' })).toBeFocused()
  await page.getByRole('button', { name: 'Appearance settings' }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Adea Dark')
})

test('nested theme-menu Escape closes only the menu; a second Escape rolls back', async ({
  page,
}) => {
  await page.getByText('Light', { exact: true }).click()
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="listbox"]')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toHaveCount(0)
  await expect(page.getByLabel('Draft preference')).toContainText('"mode":"system"')
})

test('custom accent validates before Save and native capabilities remain truthful', async ({
  page,
}) => {
  await page.getByText('Custom', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Custom accent' }).fill('invalid')
  await expect(page.getByRole('textbox', { name: 'Custom accent' })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Frosted', exact: true })).toBeDisabled()
  await expect(
    page.getByText('Transparency is unavailable on this host.', { exact: true })
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Custom accent' }).fill('#2563eb')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Committed preference')).toContainText('#2563eb')
})

test('outside dismissal restores the snapshot and Reset stays reversible', async ({ page }) => {
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked()
  await page.getByText('Dark', { exact: true }).click()
  await page.mouse.click(5, 5)
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toHaveCount(0)
  await expect(page.getByLabel('Draft preference')).toContainText('"mode":"system"')
})

test('a pending save disables changes and duplicate commits', async ({ page }) => {
  await page.evaluate(() => {
    document.body.dataset['pendingSave'] = 'true'
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toHaveAttribute(
    'aria-busy',
    'true'
  )
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Reduce transparency' })).toBeDisabled()
})

test('theme options remain visible and selectable in the narrow popup', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.getByRole('button', { name: /^Dark theme/ }).click()
  await expect(page.getByRole('option', { name: 'Dracula', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'Dracula', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Dark theme/ })).toContainText('Dracula')
})

for (const width of [320, 768, 1024, 1440]) {
  test(`composed editor at ${width}px has no overflow or serious accessibility violations`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible()
    const dialog = page.getByRole('dialog', { name: 'Appearance' })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    const result = await new AxeBuilder({ page }).include('[data-appearance-editor]').analyze()
    expect(
      result.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`appearance-${width}.png`) })
  })
}
