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
          '../../../packages/ui/tests/fixtures/action-button.tsx'
        ),
        formats: ['iife'],
        name: 'ActionButtonFixture',
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
    '<!doctype html><html lang="en"><head><title>ActionButton</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('busy state preserves the button name, disables repeat activation and announces progress', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Save workspace' })
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-busy', 'true')
  await expect(
    page.locator('span[role="status"].visually-hidden').filter({ hasText: 'Saving workspace' })
  ).toHaveText('Saving workspace')
  await button.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Activations')).toHaveText('0')

  await page.getByRole('button', { name: 'Finish save' }).click()
  await expect(button).toBeEnabled()
  await expect(button).not.toHaveAttribute('aria-busy')
  await expect(
    page.locator('span[role="status"].visually-hidden').filter({ hasText: 'Saving workspace' })
  ).toHaveCount(0)
  await button.click()
  await expect(page.getByLabel('Activations')).toHaveText('1')
})

test('tooltip listens on the polymorphic link and opens from keyboard focus', async ({ page }) => {
  const link = page.getByRole('link', { name: 'Details' })
  await link.focus()
  await expect(link).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Open details')
  await expect(link).toHaveAttribute('aria-describedby', /.+/)
  await link.evaluate((element) => element.blur())
  await expect(page.getByRole('tooltip')).toBeHidden()
  await link.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Open details')
})

test('tooltip dismisses on pointer activation and stays closed over the opened popover', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Open system status' })
  await button.hover()
  await expect(page.getByRole('tooltip')).toHaveText('View the current system status')

  await button.click()
  await expect(page.getByRole('dialog', { name: 'System status' })).toBeVisible()
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.waitForTimeout(1200)
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test('tooltip dismisses on keyboard activation and stays closed while focus remains', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Open system status' })
  await button.focus()
  await expect(page.getByRole('tooltip')).toHaveText('View the current system status')

  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'System status' })).toBeVisible()
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.waitForTimeout(1200)
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test('busy polymorphic links are inert and keep their caller handler from running', async ({
  page,
}) => {
  const link = page.getByRole('link', { name: 'Export report' })
  await expect(link).toHaveAttribute('aria-disabled', 'true')
  await expect(link).toHaveAttribute('tabindex', '0')
  await expect(link).not.toHaveAttribute('href')
  await expect(page.getByRole('status').filter({ hasText: 'Exporting report' })).toBeVisible()
  await link.focus()
  await expect(link).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Wait for the current export to finish')
  await link.evaluate((element) => element.blur())
  await expect(page.getByRole('tooltip')).toBeHidden()
  await link.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Wait for the current export to finish')
  await link.evaluate((element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  )
  await expect(page.getByLabel('Activations')).toHaveText('0')
  await expect(page).not.toHaveURL(/busy-link-navigation/)
})

test('disabled actions expose tooltip explanations without becoming activatable', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: 'Delete workspace' })
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  await expect(button).not.toHaveAttribute('disabled')
  await button.focus()
  await expect(button).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Ask a workspace owner to restore access before deleting'
  )
  await button.evaluate((element) => element.blur())
  await expect(page.getByRole('tooltip')).toBeHidden()
  await button.hover()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Ask a workspace owner to restore access before deleting'
  )
  await button.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Activations')).toHaveText('0')

  const captureButton = page.getByRole('button', { name: 'Archive workspace' })
  await expect(captureButton).toHaveAttribute('aria-disabled', 'true')
  await captureButton.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Activations')).toHaveText('0')
})
