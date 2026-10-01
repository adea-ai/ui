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

test('the send control keeps a measurable themed control height', async ({ page }) => {
  const control = page.getByRole('button', { name: 'Send message', exact: true })
  await expect(control).toBeVisible()
  await expect
    .poll(() => control.evaluate((element) => parseFloat(getComputedStyle(element).height)))
    .toBeGreaterThan(0)
})

test('icon actions explain themselves on hover', async ({ page }) => {
  for (const name of ['Send message', 'Add an attachment', 'Cancel reply']) {
    await page.getByRole('button', { name, exact: true }).hover()
    await expect(page.getByRole('tooltip')).toHaveText(name)
  }
})

test('the field exposes its native id, accessible description, and actual textarea ref', async ({
  page,
}) => {
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  await expect(box).toHaveAttribute('id', 'message-draft')
  const descriptionId = await box.getAttribute('aria-describedby')
  expect(descriptionId).toBeTruthy()
  expect(descriptionId?.split(' ')).toContain('message-instructions')
  expect(descriptionId?.split(' ')).toHaveLength(2)
  await expect(page.locator('#message-instructions')).toHaveText(
    'Do not include secrets in a message.'
  )
  const composerDescriptionId = descriptionId
    ?.split(' ')
    .find((id) => id !== 'message-instructions')
  expect(composerDescriptionId).toBeTruthy()
  await expect(page.locator(`#${composerDescriptionId}`)).toHaveText('Messages support Markdown.')

  await page.getByRole('button', { name: 'Focus message' }).click()
  await expect(box).toBeFocused()
})

test('the comfortable composer field can resize vertically and remains comfortable at 200% text', async ({
  page,
}) => {
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  await expect(box).toHaveCSS('resize', 'vertical')
  await expect
    .poll(() => box.evaluate((element) => parseFloat(getComputedStyle(element).maxHeight)))
    .toBeGreaterThan(0)

  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect
    .poll(() => box.evaluate((element) => parseFloat(getComputedStyle(element).minHeight)))
    .toBeGreaterThanOrEqual(128)
  await expect
    .poll(() => box.evaluate((element) => parseFloat(getComputedStyle(element).maxHeight)))
    .toBeGreaterThanOrEqual(384)
})

test('a failed send preserves the draft and Escape clears the announced error', async ({
  page,
}) => {
  const box = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Reject next send' }).click()
  await box.press('Enter')
  const alert = page.getByText(
    'Message not sent. Your draft is still here; retry when the connection recovers.'
  )
  await expect(alert).toBeVisible()
  await expect(box).toHaveValue('A draft')
  await box.press('Escape')
  await expect(alert).toHaveCount(0)
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
  // `install()` lets time flow between browser protocol calls. Freeze at a later
  // tick so protocol latency cannot make pauseAt target the past, then only
  // explicit `runFor` calls advance the commit window.
  const clockStart = new Date()
  await page.clock.install({ time: clockStart })
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1_000))
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
