import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
          '../../../packages/ui/tests/fixtures/chat-composer.tsx'
        ),
        formats: ['iife'],
        name: 'ChatComposerFixture',
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
    '<!doctype html><html lang="en"><head><title>Composer</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

async function dispatchPlainPaste(page: import('@playwright/test').Page, text: string) {
  return page.getByRole('textbox', { name: 'Paste-token message' }).evaluate((element, value) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', value)
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    })
    element.dispatchEvent(event)
    return { prevented: event.defaultPrevented, clipboardText: clipboardData.getData('text/plain') }
  }, text)
}

async function enablePasteTokens(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Enable paste-token editor' }).click()
  return page.getByRole('textbox', { name: 'Paste-token message' })
}

test('large text paste is one atomic text and block update with standalone placement and cleaned content', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await field.fill('prefixsuffix')
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(6, 6)
  })
  const changes = Number(await page.getByLabel('Draft changes').textContent())
  await dispatchPlainPaste(page, 'one\ntwo\nthree\n\n')

  const marker = '[ Paste #1 · 3 lines ]'
  await expect(field).toHaveValue(`prefix\n${marker}\nsuffix`)
  await expect(page.getByLabel('Paste blocks')).toHaveText('1')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(changes + 1))
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return element.selectionStart
    })
  ).toBe(`prefix\n${marker}\n`.length)
  await expect(page.locator('[data-slot="paste-token-mirror"]')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
  await expect(page.locator('[data-paste-seq="1"]')).toContainText(marker)
  await expect(page.getByRole('textbox', { name: 'Paste-token message' })).toHaveCount(1)
})

test('ordinary input prunes removed blocks in the same controlled transaction', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await dispatchPlainPaste(page, 'one\ntwo\nthree')
  await expect(page.getByLabel('Paste blocks')).toHaveText('1')
  const changes = Number(await page.getByLabel('Draft changes').textContent())

  await field.fill('A normal edit removes the token.')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(changes + 1))
})

test('raw Cmd/Ctrl+Shift+V leaves native plain text untouched and consumes only the next paste', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  const raw = 'one\ntwo\nthree\n\n'
  const keyPrevented = await field.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    )
  )
  expect(keyPrevented).toBe(true)
  const pasteResult = await dispatchPlainPaste(page, raw)
  expect(pasteResult.prevented).toBe(false)
  await field.evaluate((element, value) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    const start = element.selectionStart
    const end = element.selectionEnd
    element.value = element.value.slice(0, start) + value + element.value.slice(end)
    element.setSelectionRange(start + value.length, start + value.length)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, raw)
  await expect(field).toHaveValue(raw)
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')

  const nextPaste = await dispatchPlainPaste(page, 'four\nfive\nsix')
  expect(nextPaste.prevented).toBe(true)
  await expect(page.getByLabel('Paste blocks')).toHaveText('1')
})

test('raw-paste intent is fenced when the host changes composer scope', async ({ page }) => {
  const field = await enablePasteTokens(page)
  await field.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
    )
  })
  await page.getByRole('button', { name: 'Change scope' }).click()
  await expect(field).toHaveValue('New scope draft')
  const paste = await dispatchPlainPaste(page, 'four\nfive\nsix')
  expect(paste.prevented).toBe(true)
  await expect(field).toHaveValue('New scope draft\n[ Paste #1 · 3 lines ]')
  await expect(page.getByLabel('Paste blocks')).toHaveText('1')
})

test('short paste stays native while trailing blank lines use the controlled caret fallback', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await field.fill('prefixsuffix')
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(6, 6)
  })
  const native = await dispatchPlainPaste(page, 'short text')
  expect(native.prevented).toBe(false)

  const trimmed = await dispatchPlainPaste(page, 'short\ntext\n\n')
  expect(trimmed.prevented).toBe(true)
  await expect(field).toHaveValue('prefixshort\ntextsuffix')
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return element.selectionStart
    })
  ).toBe('prefixshort\ntext'.length)
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
})

test('submit snapshots the token draft, action, and referenced block before the host changes live state', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  const submittedText = await field.inputValue()
  await page.getByRole('button', { name: 'Send message', exact: true }).click()

  await expect(page.getByLabel('Submitted action')).toHaveText('send')
  await expect(page.getByLabel('Submitted text')).toHaveText(submittedText)
  await expect(page.getByLabel('Submitted blocks')).toHaveText(
    JSON.stringify([
      {
        id: 'fixture-1',
        seq: 1,
        lines: 3,
        content: 'first\nsecond\nthird',
      },
    ])
  )
  await expect(field).toHaveValue('Host draft changed after submit')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
})

test('backspace removes a paste token as one unit and arrow navigation skips its interior', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await field.focus()
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  const token = '[ Paste #1 · 3 lines ]'
  await field.press('ArrowLeft')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return element.selectionStart
    })
  ).toBe(0)
  await field.press('ArrowRight')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return element.selectionStart
    })
  ).toBe(token.length)
  await page.evaluate(() => {
    window.addEventListener(
      'keydown',
      (event) => {
        document.documentElement.setAttribute(
          'data-key-probe',
          JSON.stringify({ key: event.key, prevented: event.defaultPrevented })
        )
      },
      { once: true }
    )
  })
  await field.press('ArrowLeft')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  const nativeKey = JSON.parse((await page.locator('html').getAttribute('data-key-probe'))!) as {
    key: string
    prevented: boolean
  }
  expect(nativeKey).toEqual({ key: 'ArrowLeft', prevented: true })
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return element.selectionStart
    })
  ).toBe(0)
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(element.value.length, element.value.length)
  })
  const changes = Number(await page.getByLabel('Draft changes').textContent())
  await field.press('Backspace')
  await expect(field).toHaveValue('')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(changes + 1))
})

test('forward delete and a full-token selection remove markers atomically', async ({ page }) => {
  const field = await enablePasteTokens(page)
  await field.focus()
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  await dispatchPlainPaste(page, 'four\nfive\nsix')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  const secondToken = '[ Paste #2 · 3 lines ]'
  await expect(field).toHaveValue(`[ Paste #1 · 3 lines ]\n${secondToken}`)

  let changes = Number(await page.getByLabel('Draft changes').textContent())
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(0, 0)
  })
  await field.press('Delete')
  await expect(field).toHaveValue(`\n${secondToken}`)
  await expect(page.getByLabel('Paste blocks')).toHaveText('1')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(++changes))
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))

  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(1, 1 + '[ Paste #2 · 3 lines ]'.length)
  })
  await field.press('Backspace')
  await expect(field).toHaveValue('\n')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(++changes))
})

test('large paste preserves quote prefixes and ordinary standalone placement', async ({ page }) => {
  const field = await enablePasteTokens(page)
  const token = '[ Paste #1 · 3 lines ]'
  const placements = [
    { prefix: '> ', expected: `> ${token}` },
    { prefix: '> > ', expected: `> > ${token}` },
    { prefix: 'before\n> ', expected: `before\n> ${token}` },
    { prefix: '  > ', expected: `  > ${token}` },
    { prefix: 'ordinary text', expected: `ordinary text\n${token}` },
    { prefix: '   ', expected: `   \n${token}` },
  ]
  for (const placement of placements) {
    await field.fill(placement.prefix)
    const changes = Number(await page.getByLabel('Draft changes').textContent())
    const pasted = await dispatchPlainPaste(page, 'first\nsecond\nthird\n')
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
    expect(pasted.prevented).toBe(true)
    await expect(field).toHaveValue(placement.expected)
    await expect(page.getByLabel('Draft changes')).toHaveText(String(changes + 1))
    await expect(page.getByLabel('Paste blocks')).toHaveText('1')
    expect(
      await field.evaluate((element) => {
        if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
        return [element.selectionStart, element.selectionEnd]
      })
    ).toEqual([placement.expected.length, placement.expected.length])
  }
})

test('selection and line navigation snap to token edges before mouse expansion', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await field.focus()
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  const token = '[ Paste #1 · 3 lines ]'
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(2, element.value.length - 2)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return [element.selectionStart, element.selectionEnd]
    })
  ).toEqual([0, token.length])

  for (const [key, expected] of [
    ['Home', 0],
    ['End', token.length],
  ] as const) {
    await field.evaluate((element, pressedKey) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      element.setSelectionRange(4, 4)
      element.dispatchEvent(
        new KeyboardEvent('keydown', { key: pressedKey, bubbles: true, cancelable: true })
      )
    }, key)
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
    expect(
      await field.evaluate((element) => {
        if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
        return [element.selectionStart, element.selectionEnd]
      })
    ).toEqual([expected, expected])
  }

  const tokenBox = (await page.locator('[data-paste-seq="1"]').boundingBox())!
  await page.mouse.click(tokenBox.x + tokenBox.width / 2, tokenBox.y + tokenBox.height / 2)
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return [element.selectionStart, element.selectionEnd]
    })
  ).toEqual([0, token.length])

  await page.mouse.dblclick(tokenBox.x + tokenBox.width / 2, tokenBox.y + tokenBox.height / 2)
  await expect(field).toHaveValue('first\nsecond\nthird')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return [element.selectionStart, element.selectionEnd]
    })
  ).toEqual(['first\nsecond\nthird'.length, 'first\nsecond\nthird'.length])
})

test('the aria-hidden token mirror tracks textarea scroll offsets', async ({ page }) => {
  const field = await enablePasteTokens(page)
  await field.fill(Array.from({ length: 30 }, (_, index) => `line ${index}`).join('\n'))
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  const offsets = await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    const mirror = document.querySelector<HTMLElement>('[data-slot="paste-token-mirror"]')
    if (!mirror) throw new Error('Expected paste mirror')
    element.scrollTop = 24
    element.dispatchEvent(new Event('scroll'))
    return [element.scrollTop, mirror.scrollTop]
  })
  expect(offsets[0]).toBeGreaterThan(0)
  expect(offsets[0]).toBe(offsets[1])
  await expect(page.locator('[data-slot="paste-token-mirror"]')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
})

test('copy and cut expand multiple complete tokens in document order', async ({ page }) => {
  const field = await enablePasteTokens(page)
  await field.focus()
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  await dispatchPlainPaste(page, 'four\nfive\nsix')
  const secondToken = '[ Paste #2 · 3 lines ]'
  await expect(field).toHaveValue(`[ Paste #1 · 3 lines ]\n${secondToken}`)
  await expect(page.getByLabel('Paste blocks')).toHaveText('2')
  const expected = 'first\nsecond\nthird\nfour\nfive\nsix'

  const copied = await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(0, element.value.length)
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData })
    element.dispatchEvent(event)
    return { prevented: event.defaultPrevented, text: clipboardData.getData('text/plain') }
  })
  expect(copied).toEqual({ prevented: true, text: expected })

  const changes = Number(await page.getByLabel('Draft changes').textContent())
  const cut = await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(0, element.value.length)
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent('cut', { bubbles: true, cancelable: true, clipboardData })
    element.dispatchEvent(event)
    return { prevented: event.defaultPrevented, text: clipboardData.getData('text/plain') }
  })
  expect(cut).toEqual({ prevented: true, text: expected })
  await expect(field).toHaveValue('')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(changes + 1))
})

test('copy and cut expand fully selected tokens while a partial selection stays literal', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  const fullCopy = await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(0, element.value.length)
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData })
    element.dispatchEvent(event)
    return { prevented: event.defaultPrevented, text: clipboardData.getData('text/plain') }
  })
  expect(fullCopy).toEqual({ prevented: true, text: 'first\nsecond\nthird' })

  const partialCopy = await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(2, 10)
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(partialCopy).toBe(false)

  const changes = Number(await page.getByLabel('Draft changes').textContent())
  const cutText = await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(0, element.value.length)
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent('cut', { bubbles: true, cancelable: true, clipboardData })
    element.dispatchEvent(event)
    return { prevented: event.defaultPrevented, text: clipboardData.getData('text/plain') }
  })
  expect(cutText).toEqual({ prevented: true, text: 'first\nsecond\nthird' })
  await expect(field).toHaveValue('')
  await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  await expect(page.getByLabel('Draft changes')).toHaveText(String(changes + 1))
})

test('hover and caret previews associate the current token without intercepting input', async ({
  page,
}) => {
  const field = await enablePasteTokens(page)
  await dispatchPlainPaste(page, 'first\nsecond\nthird\nfourth')
  const token = page.locator('[data-paste-seq="1"]')
  const box = (await token.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(180)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2)
  await page.waitForTimeout(160)
  await expect(page.getByRole('tooltip')).toContainText('first\nsecond\nthird', { timeout: 100 })
  const panelId = await page.getByRole('tooltip').getAttribute('id')
  await expect(field).toHaveAttribute('aria-describedby', panelId!)
  await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2)
  await expect(page.getByRole('tooltip')).toHaveCount(0)

  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(4, 4)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await expect(page.getByRole('tooltip')).toContainText('first\nsecond\nthird')
  await expect(field).toHaveAttribute('aria-describedby', /.+/)
  await field.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(field).not.toHaveAttribute('aria-describedby', /.+/)
})

test('long previews stop after twelve lines and drag or blur dismisses them', async ({ page }) => {
  const field = await enablePasteTokens(page)
  await field.focus()
  await dispatchPlainPaste(
    page,
    Array.from({ length: 15 }, (_, index) => `line ${index + 1}`).join('\n')
  )
  const token = page.locator('[data-paste-seq="1"]')
  const box = (await token.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toContainText('line 12')
  await expect(tooltip).toContainText('+3 more lines')
  expect(await tooltip.textContent()).not.toContain('line 13')

  await field.evaluate((element) => element.blur())
  await expect(tooltip).toHaveCount(0)
  await field.focus()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2)
  await page.waitForTimeout(350)
  await expect(tooltip).toHaveCount(0)
  await page.mouse.up()
})

test('stale previews close when the hovered token or draft changes', async ({ page }) => {
  const field = await enablePasteTokens(page)
  await field.focus()
  await dispatchPlainPaste(page, 'first\nsecond\nthird')
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())))
  await dispatchPlainPaste(page, 'four\nfive\nsix')
  const first = (await page.locator('[data-paste-seq="1"]').boundingBox())!
  const second = (await page.locator('[data-paste-seq="2"]').boundingBox())!
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await expect(page.getByRole('tooltip')).toContainText('first\nsecond\nthird')
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toContainText('four\nfive\nsix')
  await field.fill('Replaced draft')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(field).not.toHaveAttribute('aria-describedby', /.+/)
})

test.describe('touch paste-token editing', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('touch previews stay closed and one tap expands the token', async ({ page }) => {
    const field = await enablePasteTokens(page)
    await field.focus()
    await dispatchPlainPaste(page, 'first\nsecond\nthird')
    const token = page.locator('[data-paste-seq="1"]')
    const box = (await token.boundingBox())!
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      element.setSelectionRange(4, 4)
      element.dispatchEvent(new Event('select', { bubbles: true }))
    })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(350)
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(field).toHaveValue('first\nsecond\nthird')
    await expect(page.getByLabel('Paste blocks')).toHaveText('0')
  })
})

test('collapse retains the host draft, unmounts input and shelf, and restores focused input', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('First line of unsent draft\nSecond line')
  const changes = await page.getByLabel('Draft changes').textContent()
  await page.getByRole('button', { name: 'Message input options' }).press('ArrowDown')
  await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
  const bar = page.getByRole('button', { name: 'Show the message input', exact: true })
  await expect(bar).toBeFocused()
  await expect(field).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Model context' })).toHaveCount(0)
  await expect(bar).toContainText('First line of unsent draft')
  await expect(bar).not.toContainText('Second line')
  await expect(page.getByLabel('Draft changes')).toHaveText(changes!)
  await bar.click()
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('First line of unsent draft\nSecond line')
  await expect(page.getByRole('button', { name: 'Model context' })).toBeVisible()
})
test('typing intent expands this instance without focusing a different conversation', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Message input options' }).click()
  await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
  await page.getByRole('textbox', { name: 'Other conversation' }).fill('Separate draft')
  await page.getByRole('button', { name: 'Compose here' }).click()
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Other conversation' })).toHaveValue(
    'Separate draft'
  )
})
test('failed delivery leaves the draft and exposes recovery through the composed input', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('Keep this draft')
  await field.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Message not sent')
  await expect(field).toHaveValue('Keep this draft')
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await field.press('Enter')
  await expect(page.getByLabel('Sent')).toHaveText('1')
  await expect(field).toHaveValue('')
})

test('collapse keeps the caret selection and options remain available at phone width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('Keep selected words')
  await field.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
    element.setSelectionRange(5, 13, 'backward')
  })
  await page.getByRole('button', { name: 'Message input options' }).click()
  await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
  await page.getByRole('button', { name: 'Show the message input', exact: true }).click()
  await expect(field).toBeFocused()
  expect(
    await field.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error('Expected textarea')
      return [element.selectionStart, element.selectionEnd, element.selectionDirection]
    })
  ).toEqual([5, 13, 'backward'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('the knowledge, follow-ups and adjacent band preserve their source order above staged content', async ({
  page,
}) => {
  const order = await page
    .locator('[data-slot="chat-composer"]')
    .evaluate((element) =>
      Array.from(element.querySelectorAll('[data-slot]')).map((child) =>
        child.getAttribute('data-slot')
      )
    )
  expect(order.indexOf('composer-knowledge')).toBeLessThan(order.indexOf('composer-follow-ups'))
  expect(order.indexOf('composer-follow-ups')).toBeLessThan(order.indexOf('composer-band'))
  expect(order.indexOf('composer-band')).toBeLessThan(order.indexOf('composer-staged-content'))
  expect(order.indexOf('composer-staged-content')).toBeLessThan(order.indexOf('composer-input'))
  expect(order.indexOf('composer-input')).toBeLessThan(order.indexOf('composer-action-row'))
  expect(order.indexOf('composer-action-row')).toBeLessThan(order.indexOf('composer-context'))
})

test('busy keyboard and picker share controlled mode and alternate gesture without firing on selection', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await page.getByRole('button', { name: 'Run busy' }).click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Queue/ }).click()
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await field.fill('A queued message')
  await field.press('Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('queue')
  await field.fill('Act now instead')
  await field.press('Control+Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('steer')
  await field.fill('Native candidate')
  const prevented = await field.evaluate((element) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(false)
  await expect(field).toHaveValue('Native candidate')
  await expect(page.getByLabel('Sent')).toHaveText('2')
})

test('connectivity and approval focus remain truthful and retain the host draft', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await field.fill('A draft kept during review')
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await expect(page.locator('[data-slot="chat-composer"]').getByRole('status')).toContainText(
    'Reconnect before delivery'
  )
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled()
  await field.press('Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await page.getByRole('button', { name: 'Focus approval' }).click()
  await expect(field).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Model context' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Return to input' }).click()
  await expect(field).toHaveValue('A draft kept during review')
})

test('late refusal from an older host scope cannot repaint feedback in the current one', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Delay delivery' }).click()
  await field.fill('Originating draft')
  await field.press('Enter')
  await expect(field).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Change scope' }).click()
  await expect(field).not.toHaveAttribute('readonly', '')
  await expect(field).toHaveValue('New scope draft')
  await page.getByRole('button', { name: 'Refuse old delivery' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(field).toHaveValue('New scope draft')
})

for (const density of ['comfortable', 'compact']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 768, 1024, 1440]) {
      test(`composition stays usable at ${width}px in ${theme}/${density}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 800 })
        await page.evaluate(
          ({ selectedDensity, selectedTheme }) => {
            document.documentElement.classList.toggle('dark', selectedTheme === 'dark')
            document.documentElement.setAttribute('data-density', selectedDensity)
          },
          { selectedDensity: density, selectedTheme: theme }
        )
        const field = page.getByRole('textbox', { name: 'Message', exact: true })
        await field.fill('A draft while changing appearance')
        await field.focus()
        await expect(field).toHaveValue('A draft while changing appearance')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        )
        const result = await new AxeBuilder({ page })
          .include('[data-slot="chat-composer"]')
          .analyze()
        expect(
          result.violations.filter((violation) =>
            ['serious', 'critical'].includes(violation.impact ?? '')
          )
        ).toEqual([])
        await page
          .locator('[data-slot="chat-composer"]')
          .screenshot({ path: testInfo.outputPath(`composer-${theme}-${density}-${width}.png`) })
      })
    }
  }
}

test('clean native Node server rendering supports plain and atomic compositions', async () => {
  const fixtureRoot = resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures')
  const buildFixture = async (fixture: string) => {
    const result = await build({
      root: resolve(import.meta.dirname, '../../../packages/ui'),
      configFile: false,
      logLevel: 'error',
      plugins: [solid({ ssr: true })],
      ssr: { noExternal: true },
      build: { write: false, minify: false, ssr: resolve(fixtureRoot, fixture) },
    })
    const chunks = (Array.isArray(result) ? result : [result])
      .flatMap((output) => ('output' in output ? output.output : []))
      .filter((asset) => asset.type === 'chunk')
    expect(chunks).toHaveLength(1)
    const chunk = chunks[0]
    if (!chunk) throw new Error(`Missing SSR output for ${fixture}`)
    return chunk.code
  }
  const plainFixture = await buildFixture('chat-composer-ssr.tsx')
  const atomicFixture = await buildFixture('atomic-chat-composer-ssr.tsx')
  const directory = await mkdtemp(resolve(tmpdir(), 'adea-chat-composer-ssr-'))
  try {
    await writeFile(resolve(directory, 'plain.mjs'), plainFixture)
    await writeFile(resolve(directory, 'atomic.mjs'), atomicFixture)
    await writeFile(
      resolve(directory, 'render-plain.mjs'),
      "import { renderComposer } from './plain.mjs'; process.stdout.write(JSON.stringify([renderComposer(false),renderComposer(true)]));"
    )
    const [expanded, collapsed] = JSON.parse(
      execFileSync(process.execPath, [resolve(directory, 'render-plain.mjs')], {
        encoding: 'utf8',
      })
    )
    expect(expanded).toContain('data-slot="composer-input"')
    expect(expanded).toContain('data-slot="composer-context"')
    expect(expanded).not.toContain('data-slot="paste-token-mirror"')
    expect(collapsed).not.toContain('data-slot="composer-input"')
    expect(collapsed).not.toContain('data-slot="composer-context"')
    expect(collapsed).toContain('Show the message input')
    expect(collapsed).toContain('A server-side draft')
    await writeFile(
      resolve(directory, 'render-atomic.mjs'),
      "import { renderTokenComposer } from './atomic.mjs'; process.stdout.write(renderTokenComposer());"
    )
    const tokenized = execFileSync(process.execPath, [resolve(directory, 'render-atomic.mjs')], {
      encoding: 'utf8',
    })
    expect(tokenized).toContain('Paste-token server draft')
    expect(tokenized).toContain('data-slot="paste-token-mirror"')
    expect(tokenized).toContain('aria-hidden="true"')
    expect(tokenized).toContain('[ Paste #1 · 3 lines ]')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('native content sizing grows multiline drafts, caps long ones and responds to width', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  expect(await page.evaluate(() => CSS.supports('field-sizing', 'content'))).toBe(true)
  const initial = (await field.boundingBox())!.height
  await field.fill('First line\nSecond line\nThird line')
  expect((await field.boundingBox())!.height).toBeGreaterThan(initial)
  await field.fill('Long draft line\n'.repeat(40))
  const geometry = await field.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    max: Number.parseFloat(getComputedStyle(element).maxHeight),
    overflow: element.scrollHeight > element.clientHeight,
  }))
  expect(geometry.height).toBeLessThanOrEqual(geometry.max + 1)
  expect(geometry.overflow).toBe(true)
  await field.fill('A draft that wraps only when the composer becomes a narrow phone width.')
  await page.setViewportSize({ width: 1440, height: 800 })
  const wide = (await field.boundingBox())!.height
  await page.setViewportSize({ width: 320, height: 800 })
  expect((await field.boundingBox())!.height).toBeGreaterThan(wide)
})

test('reference-only drafts queue without allowing a steer gesture', async ({ page }) => {
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await page.getByRole('button', { name: 'Stage references' }).click()
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Run busy' }).click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Send options' }).click()
  await page.getByRole('menuitemradio', { name: /Queue/ }).click()
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await expect(page.getByRole('button', { name: 'Queue message', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Send options' }).click()
  await expect(page.getByText('Ctrl/Cmd+Enter uses the other action', { exact: true })).toHaveCount(
    0
  )
  await page.keyboard.press('Escape')
  await page.getByRole('textbox', { name: 'Message', exact: true }).press('Control+Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await page.getByRole('button', { name: 'Queue message', exact: true }).click()
  await expect(page.getByLabel('Submitted action')).toHaveText('queue')
  await expect(page.getByLabel('Sent')).toHaveText('1')
})

test('host payload eligibility can refuse steering even when a draft contains text', async ({
  page,
}) => {
  const field = page.getByRole('textbox', { name: 'Message', exact: true })
  await page.getByRole('button', { name: 'Recover delivery' }).click()
  await field.fill('Context that cannot be steered')
  await page.getByRole('button', { name: 'Stage references' }).click()
  await page.getByRole('button', { name: 'Run busy' }).click()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
  await field.press('Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('none')
  await expect(field).toHaveValue('Context that cannot be steered')
  await field.press('Control+Enter')
  await expect(page.getByLabel('Submitted action')).toHaveText('queue')
  await expect(page.getByLabel('Sent')).toHaveText('1')
})
