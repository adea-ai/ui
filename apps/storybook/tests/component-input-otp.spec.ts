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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/input-otp.tsx'),
        formats: ['iife'],
        name: 'InputOtpFixture',
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
  await page.setViewportSize({ width: 800, height: 600 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Input OTP</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('the hidden input is contained by its field and the page does not scroll', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'Verification code' })
  const field = page.locator('[data-corvu-otp-field-root]').first()
  const inputBox = (await input.boundingBox())!
  const fieldBox = (await field.boundingBox())!

  expect(inputBox.x).toBeGreaterThanOrEqual(fieldBox.x)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true)
})

test('an explicitly enabled field does not draw its boxes disabled', async ({ page }) => {
  const slot = page.locator('[data-corvu-otp-field-root]').nth(1).locator('span.size-10').first()
  await expect(slot).not.toHaveAttribute('data-disabled')
  expect(await slot.evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
})
