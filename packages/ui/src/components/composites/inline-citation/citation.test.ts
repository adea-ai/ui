import { describe, expect, test } from 'bun:test'
import {
  citationLabel,
  citationName,
  nextCitationMode,
  wrapIndex,
  type CitationEvent,
  type CitationMode,
} from './citation'

const docs = { title: 'Solid reactivity', url: 'https://docs.solidjs.com/concepts' }

describe('citationLabel', () => {
  test('a valid 1-based index is the label', () => {
    expect(citationLabel(3, docs)).toBe('3')
  })

  test('without an index it is the host, then the title, then a neutral word', () => {
    expect(citationLabel(undefined, docs)).toBe('docs.solidjs.com')
    expect(citationLabel(undefined, { title: 'Local notes' })).toBe('Local notes')
    expect(citationLabel(undefined, { title: '' })).toBe('source')
    expect(citationLabel(undefined, undefined)).toBe('source')
  })

  test('never invents a number from a bad index', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10_000]) {
      expect(citationLabel(bad, docs)).toBe('docs.solidjs.com')
    }
  })

  test('a hostile host or title is clipped', () => {
    const label = citationLabel(undefined, { title: 'x'.repeat(500) })
    expect(label.length).toBeLessThanOrEqual(25)
    expect(
      citationLabel(undefined, { title: 'a', url: `https://${'h'.repeat(300)}.com` }).length
    ).toBeLessThanOrEqual(25)
  })

  test('an unsafe URL contributes no host', () => {
    expect(citationLabel(undefined, { title: 'Trap', url: 'javascript:alert(1)' })).toBe('Trap')
  })
})

describe('citationName', () => {
  test('names one source by number, title and host', () => {
    expect(citationName([docs], 2)).toBe('Source 2: Solid reactivity, docs.solidjs.com')
  })

  test('counts the rest when several sources share a badge', () => {
    expect(citationName([docs, docs, docs], 1)).toBe('Sources 1 and 2 more')
  })

  test('does not repeat a title that is already the host', () => {
    expect(citationName([{ title: 'example.com', url: 'https://example.com' }], 1)).toBe(
      'Source 1: example.com'
    )
  })

  test('has a plain name when there are no sources', () => {
    expect(citationName([], 1)).toBe('Citation')
  })
})

describe('wrapIndex', () => {
  test('wraps both ways', () => {
    expect(wrapIndex(-1, 4)).toBe(3)
    expect(wrapIndex(4, 4)).toBe(0)
    expect(wrapIndex(2, 4)).toBe(2)
    expect(wrapIndex(5, 0)).toBe(0)
  })
})

const step = (start: CitationMode, ...events: CitationEvent[]) =>
  events.reduce(nextCitationMode, start)

describe('nextCitationMode', () => {
  test('hover or keyboard focus peeks, and leaving or blurring closes the peek', () => {
    expect(step('closed', 'enter')).toBe('peek')
    expect(step('closed', 'focus')).toBe('peek')
    expect(step('closed', 'enter', 'leave')).toBe('closed')
    expect(step('closed', 'focus', 'blur')).toBe('closed')
  })

  test('pressing a badge that is only peeking pins it instead of toggling it shut', () => {
    expect(step('closed', 'enter', 'press')).toBe('pinned')
  })

  test('a pinned popover ignores hover and focus leaving', () => {
    expect(step('pinned', 'leave')).toBe('pinned')
    expect(step('pinned', 'blur')).toBe('pinned')
    expect(step('closed', 'press', 'leave', 'blur')).toBe('pinned')
  })

  test('pressing again, Escape or an outside press closes a pinned popover', () => {
    expect(step('pinned', 'press')).toBe('closed')
    expect(step('pinned', 'dismiss')).toBe('closed')
    expect(step('peek', 'dismiss')).toBe('closed')
  })

  test('hover over a pinned popover does not downgrade it', () => {
    expect(step('pinned', 'enter')).toBe('pinned')
  })
})
