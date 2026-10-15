import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { expectNoAxeViolations, hasNoHorizontalOverflow, mountFixture } from './ai-elements-harness'

let bundle: { script: string; css: string }
let dialogs: string[]

test.beforeAll(async () => {
  bundle = await bundleFixture('message-text')
})

test.beforeEach(async ({ page }) => {
  dialogs = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.dismiss()
  })
  await page.setViewportSize({ width: 800, height: 900 })
  await mountFixture(page, bundle, 'Message text')
})

type StreamWindow = Window & {
  pwned?: string[]
  setStreamText?: (text: string) => void
  setStreaming?: (streaming: boolean) => void
  tags?: Record<string, Element>
}

/** What the renderer is allowed to put in the document for model output. */
const ALLOWED = new Set([
  'DIV',
  'P',
  'SPAN',
  'A',
  'STRONG',
  'EM',
  'CODE',
  'PRE',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'BUTTON',
  // Icons inside the code block's chrome.
  'svg',
  'path',
  'rect',
  'circle',
  'line',
  'polyline',
  'g',
])

test('hostile text runs nothing and creates no element outside the allowed set', async ({
  page,
}) => {
  const report = await page.evaluate(() => {
    const roots = ['#hostile', '#hostile-streaming'].map((id) => document.querySelector(id)!)
    const elements = roots.flatMap((root) => [root, ...root.querySelectorAll('*')])
    return {
      tags: [...new Set(elements.map((element) => element.tagName))],
      handlerAttributes: elements.flatMap((element) =>
        element
          .getAttributeNames()
          .filter((name) => name.startsWith('on'))
          .map((name) => `${element.tagName}.${name}`)
      ),
      hrefs: elements.flatMap((element) => element.getAttribute('href') ?? []),
      srcs: elements.flatMap((element) => element.getAttribute('src') ?? []),
      banned: document.body.querySelectorAll(
        'script, style, iframe, img, object, embed, form, input, link, meta, audio, video, base'
      ).length,
      pwned: (window as StreamWindow).pwned,
    }
  })

  expect(dialogs).toEqual([])
  expect(report.pwned).toEqual([])
  expect(report.banned).toBe(0)
  expect(report.handlerAttributes).toEqual([])
  expect(report.srcs).toEqual([])
  for (const found of report.tags) expect(ALLOWED.has(found), `unexpected <${found}>`).toBe(true)
})

test('only http, https and mailto links become anchors, and they are safe to open', async ({
  page,
}) => {
  const anchors = await page.locator('#hostile a').evaluateAll((links) =>
    links.map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent,
      rel: link.getAttribute('rel'),
      target: link.getAttribute('target'),
    }))
  )
  // Image syntax degrades to an ordinary link: nothing is fetched until it is clicked.
  expect(anchors).toEqual([
    {
      href: 'https://example.com/tracker.png',
      text: 'image',
      rel: 'noreferrer noopener',
      target: '_blank',
    },
    {
      href: 'https://example.com/ok',
      text: 'ok',
      rel: 'noreferrer noopener',
      target: '_blank',
    },
    {
      href: 'mailto:person@example.com',
      text: 'mail',
      rel: 'noreferrer noopener',
      target: '_blank',
    },
  ])
})

test('rejected links and raw HTML stay on the page as the text that was written', async ({
  page,
}) => {
  const text = await page.locator('#hostile').innerText()
  for (const literal of [
    "[click me](javascript:window.pwned.push('link'))",
    '[again](JaVaScRiPt:alert(1))',
    '[data](data:text/html,<script>alert(1)</script>)',
    '[vb](vbscript:msgbox(1))',
    '<a href="javascript:alert(1)">raw anchor</a>',
    "<script>window.pwned.push('script')</script>",
    '<iframe src="javascript:alert(1)"></iframe>',
    '<style>body{display:none}</style>',
  ]) {
    expect(text, literal).toContain(literal)
  }
  // A hostile `<style>` did not hide the page.
  expect(await page.evaluate(() => getComputedStyle(document.body).display)).not.toBe('none')
})

test('a hostile language is a label, and code stays text', async ({ page }) => {
  const labels = await page.locator('#hostile [data-slot="code-block"]').evaluateAll((blocks) =>
    blocks.map((block) => ({
      label: block.querySelector('span.truncate')?.textContent,
      region: block.querySelector('[role="group"]')?.getAttribute('aria-label'),
      code: block.querySelector('pre')?.textContent,
    }))
  )
  expect(labels[0]?.label).toBe('"><img')
  expect(labels[0]?.region).toBe('"><img code')
  expect(labels[0]?.code).toContain("<script>window.pwned.push('code')</script>")
  expect(labels[1]).toMatchObject({ label: 'html' })
  expect(labels[1]?.code).toContain('<img src=x onerror="window.pwned.push(\'code2\')">')
  // The last fence never closed: complete when the text is final, partial while streaming.
  await expect(page.locator('#hostile').getByText('Generating…')).toHaveCount(0)
  await expect(page.locator('#hostile-streaming').getByText('Generating…')).toHaveCount(1)
})

test('markdown it does read becomes the elements it should', async ({ page }) => {
  const root = page.locator('#hostile')
  await expect(root.getByRole('heading', { level: 3 })).toHaveCount(1)
  await expect(root.locator('strong')).toContainText('bold')
  await expect(root.locator('em')).toHaveCount(1)
  await expect(root.locator('blockquote')).toHaveCount(1)
  await expect(root.locator('ul > li')).toHaveCount(2)
  expect(await hasNoHorizontalOverflow(page)).toBe(true)
})

/** Tag the node behind `selector` so a later check can tell if it was replaced. */
async function tag(page: Page, name: string, selector: string, index = 0) {
  await page.evaluate(
    (target) => {
      const fixture = window as StreamWindow
      const element = document.querySelectorAll(target.selector)[target.index]
      if (!element) throw new Error(`nothing to tag for ${target.name}`)
      ;(element as Element & { expando?: string }).expando = target.name
      ;(fixture.tags ??= {})[target.name] = element
    },
    { name, selector, index }
  )
}

const survivors = (page: Page) =>
  page.evaluate(() => {
    const fixture = window as StreamWindow
    return Object.fromEntries(
      Object.entries(fixture.tags ?? {}).map(([name, element]) => [
        name,
        {
          connected: element.isConnected,
          expando: (element as Element & { expando?: string }).expando === name,
        },
      ])
    )
  })

const setText = (page: Page, text: string) =>
  page.evaluate((next) => (window as StreamWindow).setStreamText?.(next), text)

test('streaming appends leave finished blocks, their focus and selection untouched', async ({
  page,
}) => {
  const head = [
    'First paragraph with **bold** and `code`.',
    '## A heading',
    '- one\n- two',
    '```ts\nconst a = 1\nconst b = 2\n```',
  ].join('\n\n')
  await setText(page, head)
  const stream = page.locator('#stream')
  await expect(stream.locator('[data-slot="code-block"]')).toHaveCount(1)

  await setText(page, `${head}\n\nTail`)
  await tag(page, 'paragraph', '#stream > p', 0)
  await tag(page, 'heading', '#stream > p[role="heading"]')
  await tag(page, 'list', '#stream > ul')
  await tag(page, 'code', '#stream > [data-slot="code-block"]')
  await tag(page, 'codeBody', '#stream [data-slot="code-block-body"]')

  // Focus inside the closed block, and a selection inside the first paragraph.
  await stream.getByRole('button', { name: 'Copy code' }).focus()
  await page.evaluate(() => {
    const paragraph = document.querySelector('#stream > p')!
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    ;(window as StreamWindow & { mutations?: number }).mutations = 0
    const observer = new MutationObserver((records) => {
      ;(window as StreamWindow & { mutations?: number }).mutations! += records.length
    })
    for (const selector of ['#stream > p', '#stream > p[role="heading"]', '#stream > ul']) {
      observer.observe(document.querySelector(selector)!, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      })
    }
    observer.observe(document.querySelector('#stream > [data-slot="code-block"] pre')!, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  })
  // The copy button was focused before the selection change moved nothing.
  await stream.getByRole('button', { name: 'Copy code' }).focus()

  let text = `${head}\n\nTail`
  for (let step = 1; step <= 50; step += 1) {
    text += ` word${step}`
    await setText(page, text)
  }
  await expect(page.locator('#stream > p').last()).toContainText('word50')

  expect(await survivors(page)).toEqual({
    paragraph: { connected: true, expando: true },
    heading: { connected: true, expando: true },
    list: { connected: true, expando: true },
    code: { connected: true, expando: true },
    codeBody: { connected: true, expando: true },
  })
  // Not one write to a finished block's subtree while 50 appends arrived.
  expect(
    await page.evaluate(() => (window as StreamWindow & { mutations?: number }).mutations)
  ).toBe(0)
  await expect(stream.getByRole('button', { name: 'Copy code' })).toBeFocused()
  expect(await page.evaluate(() => getSelection()!.toString())).toBe(
    'First paragraph with bold and code.'
  )
  expect(dialogs).toEqual([])
})

test('a fence that opens, grows and closes stays the same block', async ({ page }) => {
  const stream = page.locator('#stream')
  await setText(page, 'Intro paragraph.\n\n```ts\nconst a = 1')
  await expect(stream.getByText('Generating…')).toBeVisible()
  await tag(page, 'intro', '#stream > p')
  await tag(page, 'code', '#stream > [data-slot="code-block"]')

  let text = 'Intro paragraph.\n\n```ts\nconst a = 1'
  for (let line = 2; line <= 20; line += 1) {
    text += `\nconst a${line} = ${line}`
    await setText(page, text)
  }
  await expect(stream.locator('pre')).toContainText('const a20 = 20')
  await expect(stream.getByText('Generating…')).toBeVisible()

  await setText(page, `${text}\n\`\`\`\n\nAfter the code.`)
  await expect(stream.getByText('Generating…')).toHaveCount(0)
  await expect(stream.getByText('After the code.')).toBeVisible()
  expect(await survivors(page)).toEqual({
    intro: { connected: true, expando: true },
    code: { connected: true, expando: true },
  })

  // Streaming ends: the caret goes, the text stays.
  await page.evaluate(() => (window as StreamWindow).setStreaming?.(false))
  await expect(stream.locator('.streaming-caret')).toHaveCount(0)
  await expect(stream.locator('pre')).toContainText('const a20 = 20')
})

test('the streaming caret trails prose, never a code block, and is hidden from assistive tech', async ({
  page,
}) => {
  const stream = page.locator('#stream')
  await setText(page, 'Typing')
  await expect(stream.locator('.streaming-caret')).toHaveAttribute('aria-hidden', 'true')
  await setText(page, '```ts\nopen')
  await expect(stream.locator('.streaming-caret')).toHaveCount(0)
})

test('citation markers become buttons only for sources the host supplied', async ({ page }) => {
  const root = page.locator('#cited')
  const badges = root.locator('[data-slot="inline-citation"]')
  // [^1], [^2], [^1,2] and [^3] in the first paragraphs, then one in emphasis and one in the list.
  await expect(badges).toHaveCount(6)
  await expect(root.getByRole('button', { name: /Migration guide/ }).first()).toBeVisible()

  const text = await root.innerText()
  // A number beyond the list, an array index and a code span keep what was written.
  expect(text).toContain('An unknown source [^4]')
  expect(text).toContain('arr[1]')
  expect(text).toContain('`code span [^1]`'.replaceAll('`', ''))
  await expect(root.locator('code', { hasText: '[^1]' })).toHaveCount(1)

  // With no sources supplied nothing is a citation.
  const uncited = page.locator('#uncited')
  await expect(uncited.locator('[data-slot="inline-citation"]')).toHaveCount(0)
  expect(await uncited.innerText()).toContain('The order matters [^1], and the runbook agrees [^2]')
})

test('a citation opens its source from the keyboard and never links an unsafe address', async ({
  page,
}) => {
  const root = page.locator('#cited')
  const first = root.getByRole('button', { name: /Migration guide/ }).first()
  await first.focus()
  await page.keyboard.press('Enter')
  const popover = page.getByRole('dialog')
  await expect(popover).toContainText('Migration guide')
  await expect(popover.getByRole('link')).toHaveAttribute('href', 'https://example.com/guide')
  await page.keyboard.press('Escape')
  await expect(popover).toBeHidden()
  await expect(first).toBeFocused()

  // The unsafe source is named, and its address is withheld, not linked.
  await root.getByRole('button', { name: /Unsafe address/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Unsafe address')
  await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toContainText('Address not linked')
  expect(await page.evaluate(() => (window as StreamWindow).pwned)).toEqual([])
  expect(dialogs).toEqual([])
})

test('a multi-source marker names every source it cites', async ({ page }) => {
  const both = page.locator('#cited').getByRole('button', { name: 'Sources 1 and 1 more' })
  await expect(both.first()).toBeVisible()
  await both.first().click()
  const popover = page.getByRole('dialog')
  await expect(popover).toContainText('Source 1 of 2')
  await popover.getByRole('button', { name: 'Next source' }).click()
  await expect(popover).toContainText('Runbook')
})

test('line marks reach the block the host chose and no other', async ({ page }) => {
  const blocks = page.locator('#marked [data-slot="code-block"]')
  await expect(blocks).toHaveCount(2)
  const marks = await blocks.evaluateAll((all) =>
    all.map((block) =>
      [...block.querySelectorAll('[data-mark]')].map((line) => ({
        mark: line.getAttribute('data-mark'),
        tag: line.tagName,
        text: line.textContent,
      }))
    )
  )
  const strip = (value: string | null) => (value ?? '').replace(/[0-9+−!]/g, '').trim()
  expect(marks[0]?.map((line) => [line.mark, line.tag, strip(line.text)])).toEqual([
    ['add', 'INS', 'added'],
    ['remove', 'DEL', 'removed'],
  ])
  expect(marks[1]?.map((line) => [line.mark, strip(line.text)])).toEqual([['error', 'broken(']])
  // The first block alone is numbered.
  await expect(blocks.nth(0).locator('code')).toContainText('1')
  // Marks are decoration over the source: copying gives the code and nothing else.
  await blocks.nth(0).getByRole('button', { name: 'Copy code' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('keep\nadded\nremoved')
})

test('has no accessibility violations in either theme or at 320px', async ({ page }) => {
  await setText(page, 'A paragraph with **bold**, `code` and a [link](https://example.com).')
  await expectNoAxeViolations(page)
})
