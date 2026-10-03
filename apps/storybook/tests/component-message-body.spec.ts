import { expect, test } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('message-body'))
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Message body fixture</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

// Glyph boxes, not paragraph boxes: blank lines rendered inside a `pre-wrap`
// paragraph move its text away from the block without moving its box. Both
// sides measure a glyph, so the half-leading cancels out.
function glyphEdge(paragraph: HTMLElement, edge: 'first' | 'last'): number | null {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
  if (edge === 'last') nodes.reverse()
  for (const node of nodes) {
    const text = node.textContent ?? ''
    const index = edge === 'first' ? text.search(/\S/) : text.search(/\S\s*$/)
    if (index === -1) continue
    const range = document.createRange()
    range.setStart(node, index)
    range.setEnd(node, index + 1)
    const rect = range.getBoundingClientRect()
    return edge === 'first' ? rect.top : rect.bottom
  }
  return null
}

test('a code block is spaced from the paragraph after it as from the one before', async ({
  page,
}) => {
  const body = page.locator('#fenced')
  const paragraphs = body.locator(':scope > p')
  await expect(paragraphs).toHaveCount(2)
  const block = await body.locator(':scope > :not(p)').first().boundingBox()
  expect(block).not.toBeNull()
  const aboveBottom = await paragraphs.nth(0).evaluate(glyphEdge, 'last' as const)
  const belowTop = await paragraphs.nth(1).evaluate(glyphEdge, 'first' as const)
  expect(aboveBottom).not.toBeNull()
  expect(belowTop).not.toBeNull()

  const gapAbove = block!.y - aboveBottom!
  const gapBelow = belowTop! - (block!.y + block!.height)
  // The fence's own newlines once rendered as blank lines on top of the gap — two
  // extra 20px lines. A glyph's ascent and descent differ by a pixel or two, so
  // the sides agree to within a quarter line rather than exactly.
  expect(Math.abs(gapBelow - gapAbove)).toBeLessThanOrEqual(4)
  await expect(paragraphs.nth(1)).toHaveText(/^After the fence\./)
})

test('real transcript prose and fenced code retain independent readable roles at 200% text', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  const sizes = await page.evaluate(() => {
    const prose = document.querySelector<HTMLElement>('#fenced > p')
    const code = document.querySelector<HTMLElement>('#fenced pre code')
    if (!prose || !code) throw new Error('Expected transcript prose and fenced code')
    return {
      root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      prose: Number.parseFloat(getComputedStyle(prose).fontSize),
      code: Number.parseFloat(getComputedStyle(code).fontSize),
      proseFamily: getComputedStyle(prose).fontFamily,
      codeFamily: getComputedStyle(code).fontFamily,
    }
  })
  expect(sizes.root).toBe(32)
  expect(sizes.prose).toBe(28)
  expect(sizes.code).toBe(24)
  expect(sizes.proseFamily).toContain('system-ui')
  expect(sizes.codeFamily).toContain('ui-monospace')
})
