import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'
import { expectNoAxeViolations, mountFixture } from './ai-elements-harness'

const body = (page: Page, id: string) => page.locator(`#${id} [data-slot="code-block-body"]`)

test.describe('height and wrapping', () => {
  let script: string
  let css: string

  test.beforeAll(async () => {
    ;({ script, css } = await bundleFixture('code-block'))
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await page.setContent(
      '<!doctype html><html lang="en"><head><title>Code block</title></head><body></body></html>'
    )
    await page.addStyleTag({ content: css })
    await page.addScriptTag({ content: script })
  })

  test('maxHeight caps the body and scrolls it; the default still grows', async ({ page }) => {
    const metrics = (id: string) =>
      body(page, id).evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        scrollHeight: element.scrollHeight,
        overflowY: getComputedStyle(element).overflowY,
      }))

    const grown = await metrics('default-block')
    expect(grown.height).toBeGreaterThan(600)
    expect(grown.scrollHeight).toBeLessThanOrEqual(Math.ceil(grown.height))

    const px = await metrics('capped-px')
    expect(px.height).toBeCloseTo(200, 0)
    expect(px.overflowY).toBe('auto')
    expect(px.scrollHeight).toBeGreaterThan(px.height)

    const rootFontSize = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    )
    const length = await metrics('capped-length')
    expect(length.height).toBeCloseTo(10 * rootFontSize, 0)

    // The capped region stays a named tab stop and scrolls from the keyboard.
    const region = page.getByRole('group', { name: 'ts code' }).nth(1)
    await expect(region).toHaveAttribute('tabindex', '0')
    await region.focus()
    await page.keyboard.press('End')
    await expect.poll(() => body(page, 'capped-px').evaluate((e) => e.scrollTop)).toBeGreaterThan(0)

    // Under its threshold, a capped block does not repeat its action row.
    await expect(page.locator('#capped-px [data-code-block-footer]')).toHaveCount(0)
    await expect(page.locator('#default-block [data-code-block-footer]')).toHaveCount(1)
  })

  test('wrap soft-wraps long lines instead of scrolling sideways', async ({ page }) => {
    const sideways = (id: string) =>
      body(page, id).evaluate((element) => element.scrollWidth - element.clientWidth)

    expect(await sideways('unwrapped')).toBeGreaterThan(0)
    await expect(body(page, 'unwrapped')).not.toHaveAttribute('data-wrap')
    for (const id of ['wrapped', 'wrapped-numbered', 'wrapped-highlight']) {
      expect(await sideways(id), id).toBeLessThanOrEqual(0)
      await expect(body(page, id)).toHaveAttribute('data-wrap', '')
    }
    // Wrapping is visual only: the copied and rendered text is unchanged.
    await expect(page.locator('#wrapped pre')).toHaveText(
      await page.locator('#unwrapped pre').innerText()
    )
    const wrappedHeight = await body(page, 'wrapped').evaluate((e) => e.clientHeight)
    const unwrappedHeight = await body(page, 'unwrapped').evaluate((e) => e.clientHeight)
    expect(wrappedHeight).toBeGreaterThan(unwrappedHeight)
  })
})

type OutputFixture = {
  sources: Record<string, string>
  copies: { id: string; ok: boolean }[]
  calls: Record<string, (string | undefined)[]>
  renderMs: number
  resolveLate: () => void
  rejectLate: () => void
  setComplete: (complete: boolean) => void
  appendStreamed: () => void
}
type OutputWindow = Window & typeof globalThis & { fixture: OutputFixture; written?: string[] }

const source = (page: Page, id: string) =>
  page.evaluate((key) => (window as OutputWindow).fixture.sources[key]!, id)
const written = (page: Page) => page.evaluate(() => (window as OutputWindow).written!)
const copyButton = (page: Page, id: string) =>
  page
    .locator(`#${id}`)
    .getByRole('button', { name: /^Cop(y code|ied)$/ })
    .first()
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

test.describe('output: copy, marks, lazy highlighting, bounds', () => {
  let bundle: { script: string; css: string }
  let problems: string[]

  test.beforeAll(async () => {
    bundle = await bundleFixture('code-block-output')
  })

  test.beforeEach(async ({ page }) => {
    problems = []
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`)
    })
    await page.setViewportSize({ width: 800, height: 900 })
    await mountFixture(page, bundle, 'Code block output')
    // Record exactly what the component hands to the clipboard, then forward it.
    await page.evaluate(() => {
      const target = window as OutputWindow
      target.written = []
      const original = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = async (text: string) => {
        target.written!.push(text)
        return original(text)
      }
    })
  })

  test.afterEach(() => {
    expect(problems).toEqual([])
  })

  test('copy writes the code exactly, however the block is drawn', async ({ page }) => {
    for (const id of ['trailing', 'marked', 'partial', 'unknown', 'unicode']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded()
      const before = (await written(page)).length
      await copyButton(page, id).click()
      await expect.poll(async () => (await written(page)).length, { message: id }).toBe(before + 1)
      expect((await written(page)).at(-1), id).toBe(await source(page, id))
      // The button confirms only after the clipboard accepted it.
      await expect(page.locator(`#${id}`).getByRole('button', { name: 'Copied' })).toBeVisible()
    }
    expect(await page.evaluate(() => (window as OutputWindow).fixture.copies)).toEqual([
      { id: 'trailing', ok: true },
      { id: 'marked', ok: true },
      { id: 'partial', ok: true },
      { id: 'unknown', ok: true },
      { id: 'unicode', ok: true },
    ])
  })

  test('the trailing newline, numbers, marks and hidden lines never reach the clipboard', async ({
    page,
  }) => {
    await copyButton(page, 'trailing').click()
    await expect.poll(() => clipboard(page)).toBe('alpha\nbeta\n')

    // Only 10 of 30 lines are drawn; all 30 are copied, with no gutter text in them.
    await expect(page.locator('#marked code > *')).toHaveCount(10)
    await copyButton(page, 'marked').click()
    await expect.poll(() => clipboard(page)).toBe(await source(page, 'marked'))
    const copied = await clipboard(page)
    expect(copied.split('\n')).toHaveLength(30)
    expect(copied).not.toMatch(/^[+−!]/m)
  })

  test('copy of a 20,000-line block copies every line though few are drawn', async ({ page }) => {
    await copyButton(page, 'big').click()
    await expect.poll(async () => (await written(page)).length).toBe(1)
    const text = (await written(page))[0]!
    expect(text).toBe(await source(page, 'big'))
    expect(text.split('\n')).toHaveLength(20_000)
  })

  test('copy reports a refused clipboard instead of confirming it', async ({ page }) => {
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new DOMException('Document is not focused', 'NotAllowedError')
      }
    })
    await copyButton(page, 'trailing').click()
    await expect
      .poll(() => page.evaluate(() => (window as OutputWindow).fixture.copies))
      .toEqual([{ id: 'trailing', ok: false }])
    await expect(page.locator('#trailing').getByRole('button', { name: 'Copied' })).toHaveCount(0)
    await expect(copyButton(page, 'trailing')).toHaveAttribute(
      'title',
      'Copying is unavailable in this context'
    )
  })

  test('copying a selection of a numbered, marked block yields the source, not the gutter', async ({
    page,
  }) => {
    const selection = page.locator('#selection')
    await selection.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const range = document.createRange()
      range.selectNodeContents(document.querySelector('#selection code')!)
      const current = getSelection()!
      current.removeAllRanges()
      current.addRange(range)
    })
    await page.keyboard.press('ControlOrMeta+C')
    await expect.poll(() => clipboard(page)).toContain('first line')
    const copied = await clipboard(page)
    expect(copied.replace(/\r/g, '').trim()).toBe(await source(page, 'selection'))
    // Not one digit, plus, minus or bang from the gutter.
    expect(copied).not.toMatch(/(^|\n)\s*[0-9+−!]/)

    // And the gutter is unselectable by construction, not by luck of layout.
    const gutters = await selection
      .locator('code [aria-hidden="true"]')
      .evaluateAll((spans) => spans.map((span) => getComputedStyle(span).userSelect))
    expect(gutters.length).toBeGreaterThan(0)
    expect(new Set(gutters)).toEqual(new Set(['none']))
  })

  test('marks are elements and words, never colour alone', async ({ page }) => {
    const rows = await page.locator('#marks code > *').evaluateAll((elements) =>
      elements.map((element) => {
        const glyph = element.querySelector('[data-slot="code-line-mark"]')!
        return {
          tag: element.tagName,
          mark: element.getAttribute('data-mark'),
          glyph: glyph.textContent,
          hidden: glyph.getAttribute('aria-hidden'),
          select: getComputedStyle(glyph).userSelect,
        }
      })
    )
    expect(rows.map((row) => [row.tag, row.mark, row.glyph])).toEqual([
      ['INS', 'add', '+'],
      ['DEL', 'remove', '−'],
      ['SPAN', 'highlight', ''],
      ['SPAN', 'error', '!'],
      ['SPAN', null, ''],
    ])
    for (const row of rows) {
      expect(row.hidden).toBe('true')
      expect(row.select).toBe('none')
    }
    // The browser's own underline and strike-through are not what carries the mark.
    const decorations = await page
      .locator('#marks ins, #marks del')
      .evaluateAll((elements) => elements.map((e) => getComputedStyle(e).textDecorationLine))
    expect(decorations).toEqual(['none', 'none'])
    await expect(page.locator('#marks code')).toContainText('removed line')
  })

  test('the block renders no more than lineLimit rows and offers the rest', async ({ page }) => {
    expect(await page.evaluate(() => (window as OutputWindow).fixture.renderMs)).toBeLessThan(5_000)
    await expect(page.locator('#big code > *')).toHaveCount(2_000)
    await expect(
      page.locator('#big').getByText('Showing the first 2,000 of 20,000 lines.')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show all 20,000 lines' })).toBeVisible()
    // Nothing is drawn past the limit, in a block whose body would otherwise be a million px tall.
    const height = await page
      .locator('#big')
      .evaluate((element) => element.getBoundingClientRect().height)
    expect(height).toBeLessThan(60_000)
  })

  test('"Show all" draws every line, and keyboard focus is not dropped when the button goes', async ({
    page,
  }) => {
    await expect(page.locator('#medium code > *')).toHaveCount(100)
    const showAll = page.getByRole('button', { name: 'Show all 1,500 lines' })
    await showAll.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#medium code > *')).toHaveCount(1_500)
    await expect(showAll).toHaveCount(0)
    await expect(page.locator('#medium').getByText(/Showing the first/)).toHaveCount(0)
    // Focus must land somewhere inside the block, not on <body>.
    const owner = await page.evaluate(
      () => document.activeElement?.closest('#medium')?.id ?? 'none'
    )
    expect(owner).toBe('medium')
  })

  test('a capped body scrolls from the keyboard', async ({ page }) => {
    const region = page.locator('#scroll [role="group"]')
    await expect(region).toHaveAttribute('tabindex', '0')
    await region.focus()
    const top = () => region.evaluate((element) => element.scrollTop)
    expect(await top()).toBe(0)
    await page.keyboard.press('ArrowDown')
    await expect.poll(top).toBeGreaterThan(0)
    const afterArrow = await top()
    await page.keyboard.press('PageDown')
    await expect.poll(top).toBeGreaterThan(afterArrow)
    await page.keyboard.press('End')
    await expect
      .poll(() =>
        region.evaluate(
          (element) => element.scrollHeight - element.clientHeight - element.scrollTop
        )
      )
      .toBeLessThanOrEqual(1)
    await page.keyboard.press('Home')
    await expect.poll(top).toBe(0)
  })

  test('a loader resolving later swaps in highlighted output without changing height', async ({
    page,
  }) => {
    const block = page.locator('#late')
    await block.scrollIntoViewIfNeeded()
    const measure = () =>
      block.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        text: element.querySelector('pre')!.textContent,
      }))
    const plain = await measure()
    await expect(block.locator('[data-highlighted]')).toHaveCount(0)
    expect(await page.evaluate(() => (window as OutputWindow).fixture.calls['late'])).toEqual([
      'ts',
    ])

    await page.evaluate(() => (window as OutputWindow).fixture.resolveLate())
    await expect(block.locator('[data-highlighted]')).toHaveCount(1)
    await expect(block.locator('.text-primary').first()).toBeVisible()
    const highlighted = await measure()
    expect(highlighted.text).toBe(plain.text)
    expect(Math.abs(highlighted.height - plain.height)).toBeLessThanOrEqual(0.5)
    // Loaded once, not once per render.
    expect(await page.evaluate(() => (window as OutputWindow).fixture.calls['late'])).toEqual([
      'ts',
    ])
  })

  test('a failing, empty or badly behaved loader leaves plain text and no error', async ({
    page,
  }) => {
    for (const [id, text] of [
      ['rejected', 'const rejected = true'],
      ['throws', 'const throws = true'],
      ['returns-nothing', 'const sloppy = true'],
      ['unknown', "qapla\nbat'leth"],
    ] as const) {
      await expect(page.locator(`#${id} pre`), id).toHaveText(text)
      await expect(page.locator(`#${id} [data-highlighted]`), id).toHaveCount(0)
    }
    // The page still works: another block still copies.
    await copyButton(page, 'trailing').click()
    await expect.poll(async () => (await written(page)).length).toBe(1)
    // The late loader failing after the fact also changes nothing.
    await page.evaluate(() => (window as OutputWindow).fixture.rejectLate())
    await expect(page.locator('#late pre')).toBeVisible()
    await expect(page.locator('#late [data-highlighted]')).toHaveCount(0)
  })

  test('a loader is not called while the block streams, and once when it completes', async ({
    page,
  }) => {
    const calls = () => page.evaluate(() => (window as OutputWindow).fixture.calls['streaming'])
    expect(await calls()).toBeUndefined()
    await expect(page.locator('#streaming').getByText('Generating…')).toBeVisible()
    for (let step = 0; step < 10; step += 1) {
      await page.evaluate(() => (window as OutputWindow).fixture.appendStreamed())
    }
    await expect(page.locator('#streaming pre')).toContainText('streamed 13')
    expect(await calls()).toBeUndefined()
    await expect(page.locator('#streaming [data-highlighted]')).toHaveCount(0)

    await page.evaluate(() => (window as OutputWindow).fixture.setComplete(true))
    await expect(page.locator('#streaming [data-highlighted]')).toHaveCount(1)
    await expect(page.locator('#streaming').getByText('Generating…')).toHaveCount(0)
    expect(await calls()).toEqual(['ts'])
    await expect(page.locator('#streaming [data-highlighted]')).toContainText('streamed 13')
  })

  test('an explicit highlight wins and the loader is never asked', async ({ page }) => {
    await expect(page.locator('#explicit [data-highlighted]')).toHaveCount(1)
    expect(
      await page.evaluate(() => (window as OutputWindow).fixture.calls['explicit'])
    ).toBeUndefined()
  })

  test('a block without a language still asks the loader, with undefined', async ({ page }) => {
    await expect(page.locator('#no-language pre')).toHaveText('no language here')
    expect(
      await page.evaluate(() => (window as OutputWindow).fixture.calls['no-language'])
    ).toEqual([undefined])
  })

  test('has no accessibility violations in either theme or at 320px', async ({ page }) => {
    await page.locator('#late').scrollIntoViewIfNeeded()
    await page.evaluate(() => (window as OutputWindow).fixture.resolveLate())
    // The two large blocks are left out because axe walks every node and they hold thousands of rows.
    await expectNoAxeViolations(page, { exclude: ['#big', '#medium'] })
  })

  // Every block is a named, focusable `group`, not a `region` landmark: a
  // transcript with two blocks in one language would otherwise list "ts code"
  // twice as a landmark, and a long answer would fill the landmark list.
  test('blocks of one language are not duplicate landmarks', async ({ page }) => {
    const names = await page
      .locator('[data-slot="code-block-body"]')
      .evaluateAll((bodies) => bodies.map((element) => element.getAttribute('aria-label')))
    expect(names.filter((name) => name === 'ts code').length).toBeGreaterThan(1)
    await expect(page.locator('[data-slot="code-block-body"][role="region"]')).toHaveCount(0)
    const result = await new AxeBuilder({ page }).withRules(['landmark-unique']).analyze()
    expect(result.violations).toEqual([])
    // Still a named tab stop for the keyboard.
    await expect(page.getByRole('group', { name: 'ts code' }).first()).toHaveAttribute(
      'tabindex',
      '0'
    )
  })
})
