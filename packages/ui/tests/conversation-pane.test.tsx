import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The conversation pane and composer menu contracts.
 *
 * The unit lane has no DOM, so — like the control-slot table — these read the
 * component's own source and hold the literals that decide behaviour: the
 * thread overlay hiding the conversation with `visibility` rather than
 * `display`, the shared overlay chrome on a composer menu, and the status slot
 * landing inside the composer's own live region. The exact grid and gutter
 * arithmetic is design-system source (whose lane allows off-token values) and
 * is held by the storybook and packed lanes instead.
 */
const root = resolve(import.meta.dirname, '../src/components/conversation')

function exportedBody(file: string, name: string): string {
  const source = readFileSync(resolve(root, file), 'utf8')
  const start = source.search(new RegExp(`^export function ${name}\\b`, 'm'))
  if (start < 0) throw new Error(`${name} is not exported from ${file}`)
  const next = source.slice(start + 1).search(/^export /m)
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next)
}

describe('ConversationPane', () => {
  const body = exportedBody('conversation-pane.tsx', 'ConversationPane')

  test('frames the conversation as header / transcript / composer rows', () => {
    expect(body).toContain('data-slot="conversation-pane"')
    expect(body).toContain('grid-rows-[auto_')
    expect(body).toContain("'grid-cols-1'")
  })

  test('the thread overlay hides the conversation with visibility, not display', () => {
    // A hidden element keeps its layout and its DOM; `display: none` would
    // unmount the reader's scroll position the first time a phone opens a
    // thread, and leaving the accessibility tree is the point.
    expect(body).toContain('max-md:invisible')
    expect(body).not.toContain('max-md:hidden')
    expect(body).toContain('max-md:absolute max-md:inset-0')
  })

  test('a pane without a thread never hides its chrome', () => {
    // Both hiding classes are gated on the thread being open; a plain
    // conversation renders every slot visible at every width.
    expect(body).toContain("threadOpen() && 'max-md:invisible'")
  })

  test('the composer slot carries the gutter classes only with the gutter prop', () => {
    expect(body).toContain("local.gutter && 'mx-[clamp(")
  })
})

describe('ConversationSurface gutter', () => {
  const body = exportedBody('conversation-surface.tsx', 'ConversationSurface')

  test('the transcript reads with the shared page gutter inside its scroller', () => {
    expect(body).toContain("'px-[clamp(")
    expect(body).toContain('scrollbar-gutter')
  })
})

describe('ComposerMenu', () => {
  const body = exportedBody('composer-menu.tsx', 'ComposerMenu')

  test('paints the shared overlay rung and scrolls within the composer height', () => {
    expect(body).toContain('overlaySurface')
    expect(body).toContain('max-h-56')
    expect(body).toContain('overflow-y-auto')
  })

  test('a labelled menu announces what it offers', () => {
    expect(body).toContain('aria-label={local.label}')
    expect(body).toContain('role="group"')
  })

  test('a menu row is a full-width ghost button that starts its text', () => {
    const row = exportedBody('composer-menu.tsx', 'ComposerMenuItem')
    expect(row).toContain('variant="ghost"')
    expect(row).toContain('w-full justify-start')
    expect(row).toContain('text-start')
  })
})

describe('MessageComposer status slot', () => {
  const body = exportedBody('message-composer.tsx', 'MessageComposer')

  test('renders host progress inside the composer live region', () => {
    // One live region per composer: host status lands in the same role="status"
    // region as the composer's own sending copy, never in a second region that
    // races it.
    const region = body.slice(body.indexOf('role="status"'))
    expect(region).toContain('local.status')
  })
})
