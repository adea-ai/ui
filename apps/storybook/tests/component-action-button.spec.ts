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

test('busy state preserves the button name, disables repeat activation and announces progress', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>ActionButton</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

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
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>ActionButton</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  const link = page.getByRole('link', { name: 'Details' })
  await link.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Open details')
  await link.focus()
  await expect(link).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('Open details')
  await expect(link).toHaveAttribute('aria-describedby', /.+/)
})

test('busy polymorphic links are inert and keep their caller handler from running', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>ActionButton</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  const link = page.getByRole('link', { name: 'Export report' })
  await expect(link).toHaveAttribute('aria-disabled', 'true')
  await expect(link).toHaveAttribute('tabindex', '-1')
  await expect(link).not.toHaveAttribute('href')
  await expect(page.getByRole('status').filter({ hasText: 'Exporting report' })).toBeVisible()
  await link.evaluate((element) =>
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  )
  await expect(page.getByLabel('Activations')).toHaveText('0')
  await expect(page).not.toHaveURL(/busy-link-navigation/)
})
