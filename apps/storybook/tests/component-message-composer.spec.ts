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
          '../../../packages/ui/tests/fixtures/message-composer.tsx'
        ),
        formats: ['iife'],
        name: 'ComposerFixture',
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
    '<!doctype html><html lang="en"><head><title>Composer fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('plain Enter sends and Shift+Enter keeps the soft break', async ({ page }) => {
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  await box.press('Enter')
  await expect(page.getByLabel('Send count')).toHaveText('1')
  await box.press('Shift+Enter')
  await expect(page.getByLabel('Send count')).toHaveText('1')
  await expect(box).toHaveValue(/\n/)
})

for (const signal of ['isComposing', 'keyCode'] as const) {
  test(`a native IME ${signal} Enter keeps the candidate default and never sends`, async ({
    page,
  }) => {
    const prevented = await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .evaluate(async (element, nativeSignal) => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: nativeSignal === 'isComposing',
          keyCode: nativeSignal === 'keyCode' ? 229 : 13,
        })
        element.dispatchEvent(event)
        await Promise.resolve()
        await Promise.resolve()
        return event.defaultPrevented
      }, signal)
    expect(prevented).toBe(false)
    await expect(page.getByLabel('Send count')).toHaveText('0')
  })
}

test('tracked composition protects Enter even when browser flags are clear', async ({ page }) => {
  const result = await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .evaluate(async (element) => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      element.dispatchEvent(event)
      await Promise.resolve()
      await Promise.resolve()
      return { prevented: event.defaultPrevented, draft: (element as HTMLTextAreaElement).value }
    })
  expect(result).toEqual({ prevented: true, draft: 'A draft' })
  await expect(page.getByLabel('Send count')).toHaveText('0')
})

test('post-composition commit Enter is consumed; a separate later Enter sends', async ({
  page,
}) => {
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  const prevented = await box.evaluate(async (element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    element.dispatchEvent(event)
    await Promise.resolve()
    await Promise.resolve()
    return event.defaultPrevented
  })
  expect(prevented).toBe(true)
  await expect(page.getByLabel('Send count')).toHaveText('0')
  // A separate key after the donor's 50ms post-commit window is the positive
  // recovery control. Waiting is required by the behavior under test.
  await box.evaluate(() => new Promise((finishWait) => setTimeout(finishWait, 75)))
  await box.press('Enter')
  await expect(page.getByLabel('Send count')).toHaveText('1')
})

test('a fresh composition cannot be released by the previous commit timer', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Message', exact: true }).evaluate(async (element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    await new Promise((finishWait) => setTimeout(finishWait, 75))
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
    await Promise.resolve()
  })
  await expect(page.getByLabel('Send count')).toHaveText('0')
})

test('blur recovers a composition abandoned without compositionend', async ({ page }) => {
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  await box.focus()
  await box.dispatchEvent('compositionstart')
  await page.getByRole('button', { name: 'Toggle composer' }).focus()
  await box.press('Enter')
  await expect(page.getByLabel('Send count')).toHaveText('1')
})

test('a menu or host that already claimed Enter retains its input ownership', async ({ page }) => {
  await page.evaluate(() => {
    document.addEventListener('keydown', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    })
  })
  await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter')
  await expect(page.getByLabel('Send count')).toHaveText('0')
})

test('repeated composition ends cannot release the latest commit window early', async ({
  page,
}) => {
  await page.clock.install()
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  await box.dispatchEvent('compositionstart')
  await box.dispatchEvent('compositionend')
  await page.clock.runFor(40)
  await box.dispatchEvent('compositionend')
  await page.clock.runFor(20)
  await box.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  await expect(page.getByLabel('Send count')).toHaveText('0')
  await page.clock.runFor(40)
  await box.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  await expect(page.getByLabel('Send count')).toHaveText('1')
})
