import { describe, expect, test } from 'bun:test'
import {
  countLines,
  expandAll,
  findTokenRanges,
  formatToken,
  isPasteBlock,
  nextSeq,
  PASTE_TOKEN_REGEX,
  pruneBlocks,
  recollapsePastes,
  remapCarriedBlocks,
  shouldCollapse,
  stripTrailingBlankLines,
  tokenRangeAt,
  type PasteBlock,
} from '../src/components/conversation/paste-tokens'

const block = (overrides: Partial<PasteBlock> = {}): PasteBlock => ({
  id: overrides.id ?? 'paste-a',
  seq: overrides.seq ?? 1,
  lines: overrides.lines ?? 3,
  content: overrides.content ?? 'a\nb\nc',
})

describe('paste token model', () => {
  test('uses the donor collapse thresholds and counts a trailing newline as a line', () => {
    expect(countLines('hello')).toBe(1)
    expect(countLines('a\nb\n')).toBe(3)
    expect(countLines('')).toBe(0)
    expect(shouldCollapse('a\nb\nc')).toBe(true)
    expect(shouldCollapse('a\nb')).toBe(false)
    expect(shouldCollapse('x'.repeat(199))).toBe(false)
    expect(shouldCollapse('x'.repeat(200))).toBe(true)
    expect(shouldCollapse('')).toBe(false)
  })

  test('formats canonical markers and accepts host-provided stable IDs', () => {
    const paste = block({ id: 'host_01.abc-123', seq: 3, lines: 42 })
    expect(isPasteBlock(paste)).toBe(true)
    expect(formatToken(paste)).toBe('[ Paste #3 · 42 lines ]')
  })

  test('rejects malformed IDs and unsafe sequence metadata at the host boundary', () => {
    expect(isPasteBlock({ ...block(), id: '' })).toBe(false)
    expect(isPasteBlock({ ...block(), id: 'has spaces' })).toBe(false)
    expect(isPasteBlock({ ...block(), id: 'x'.repeat(129) })).toBe(false)
    expect(isPasteBlock({ ...block(), seq: 0 })).toBe(false)
    expect(isPasteBlock({ ...block(), seq: Number.MAX_SAFE_INTEGER + 1 })).toBe(false)
    expect(isPasteBlock({ ...block(), lines: 0 })).toBe(false)
    expect(isPasteBlock({ ...block(), content: 1 })).toBe(false)
    expect(() => formatToken({ ...block(), seq: 0 })).toThrow(TypeError)
  })

  test('allocates the next sequence from the maximum while tolerating gaps', () => {
    expect(nextSeq([])).toBe(1)
    expect(nextSeq([block({ seq: 1 }), block({ id: 'paste-b', seq: 4 })])).toBe(5)
    expect(() => nextSeq([block({ seq: Number.MAX_SAFE_INTEGER })])).toThrow(RangeError)
  })

  test('finds known canonical markers in document order and ignores forged variants', () => {
    const first = block({ id: 'one', seq: 5, lines: 3, content: 'first' })
    const second = block({ id: 'two', seq: 2, lines: 9, content: 'second' })
    const text = [
      formatToken(second),
      '[ Paste #5 · 999 lines ]',
      '[ Paste #99 · 3 lines ]',
      '[ Paste #05 · 3 lines ]',
      '[ Paste #0 · 3 lines ]',
      '[ Paste #9007199254740992 · 3 lines ]',
      formatToken(first),
    ].join(' ')

    const ranges = findTokenRanges(text, [first, second])
    expect(ranges.map((range) => range.block.id)).toEqual(['two', 'one'])
    expect(ranges.map(({ start, end }) => text.slice(start, end))).toEqual([
      formatToken(second),
      formatToken(first),
    ])
  })

  test('scans with private parser state even after the exported regex was advanced', () => {
    const paste = block()
    const text = formatToken(paste)
    PASTE_TOKEN_REGEX.lastIndex = text.length

    expect(findTokenRanges(text, [paste])).toHaveLength(1)
    PASTE_TOKEN_REGEX.lastIndex = 0
  })

  test('does not resolve ambiguous duplicate IDs or sequences', () => {
    const one = block({ id: 'duplicate', seq: 1, content: 'one' })
    const two = block({ id: 'duplicate', seq: 2, content: 'two' })
    const three = block({ id: 'three', seq: 1, content: 'three' })
    const text = `${formatToken(one)} ${formatToken(two)}`

    expect(findTokenRanges(text, [one, two])).toEqual([])
    expect(findTokenRanges(text, [one, three])).toEqual([])
    expect(expandAll(text, [one, two])).toBe(text)
  })

  test('finds a token at its inclusive caret boundaries and rejects out-of-range carets', () => {
    const paste = block()
    const text = `prefix ${formatToken(paste)} suffix`
    const start = text.indexOf('[')
    const end = start + formatToken(paste).length

    expect(tokenRangeAt(text, [paste], start)?.block.id).toBe(paste.id)
    expect(tokenRangeAt(text, [paste], end)?.block.id).toBe(paste.id)
    expect(tokenRangeAt(text, [paste], 0)).toBeNull()
    expect(tokenRangeAt(text, [paste], -1)).toBeNull()
    expect(tokenRangeAt(text, [paste], Number.POSITIVE_INFINITY)).toBeNull()
  })

  test('prunes only blocks with surviving markers and preserves the input reference when unchanged', () => {
    const keep = block({ id: 'keep', seq: 1 })
    const drop = block({ id: 'drop', seq: 2 })
    expect(pruneBlocks(formatToken(keep), [keep, drop])).toEqual([keep])

    const all = [keep]
    expect(pruneBlocks(formatToken(keep), all)).toBe(all)
    expect(pruneBlocks('[ Paste #1 · 999 lines ]', all)).toEqual([])
  })

  test('expands known markers while retaining unknown and noncanonical text verbatim', () => {
    const known = block({ seq: 1, content: 'large\npaste' })
    const unknown = block({ id: 'unknown', seq: 99, content: 'not present' })
    const text = `${formatToken(known)} and ${formatToken(unknown)} and [ Paste #1 · 2 lines ]`
    expect(expandAll(text, [known])).toBe(
      'large\npaste and [ Paste #99 · 3 lines ] and [ Paste #1 · 2 lines ]'
    )
  })

  test('inserts pasted content verbatim without recursively resolving token-like text', () => {
    const nested = block({ id: 'nested', seq: 2, content: 'inner body' })
    const outer = block({ id: 'outer', seq: 1, lines: 1, content: formatToken(nested) })

    expect(expandAll(formatToken(outer), [outer, nested])).toBe(formatToken(nested))
  })

  test('remaps collisions in one right-to-left pass without changing block identity', () => {
    const first = block({ id: 'first', seq: 1, lines: 3, content: 'first body' })
    const second = block({ id: 'second', seq: 2, lines: 3, content: 'second body' })
    const text = `${formatToken(first)} ${formatToken(second)}`
    const used = new Set([1])

    const result = remapCarriedBlocks(text, [first, second], used)
    expect(result.text).toBe('[ Paste #2 · 3 lines ] [ Paste #3 · 3 lines ]')
    expect(result.blocks).toEqual([
      { ...first, seq: 2 },
      { ...second, seq: 3 },
    ])
    expect(result.blocks[0]).not.toBe(first)
    expect(used).toEqual(new Set([1, 2, 3]))
  })

  test('skips an already-carried sequence before allocating a collision', () => {
    const kept = block({ id: 'kept', seq: 2, lines: 3 })
    const carried = block({ id: 'carried', seq: 1, lines: 3 })
    const text = `${formatToken(kept)} ${formatToken(carried)}`
    const used = new Set([1])

    const result = remapCarriedBlocks(text, [kept, carried], used)
    expect(result.text).toBe('[ Paste #2 · 3 lines ] [ Paste #3 · 3 lines ]')
    expect(result.blocks[0]).toBe(kept)
    expect(result.blocks[1]).toEqual({ ...carried, seq: 3 })
  })

  test('rejects ambiguous carried identities instead of assigning unstable replacements', () => {
    const one = block({ id: 'same', seq: 1 })
    const sameSeq = block({ id: 'two', seq: 1 })
    const sameId = block({ id: 'same', seq: 2 })
    expect(() => remapCarriedBlocks('', [one, sameSeq], new Set([1]))).toThrow(TypeError)
    expect(() => remapCarriedBlocks('', [one, sameId], new Set([1]))).toThrow(TypeError)
  })

  test('recollapses verbatim and trailing-whitespace-trimmed content', () => {
    const first = block({ id: 'first', seq: 1, lines: 3, content: 'A\nB\nC' })
    const trailing = block({ id: 'tail', seq: 2, lines: 2, content: 'X\nY  \n' })
    expect(recollapsePastes(`before ${first.content} after`, [first])).toBe(
      `before ${formatToken(first)} after`
    )
    expect(recollapsePastes('prefix X\nY', [trailing])).toBe(`prefix ${formatToken(trailing)}`)
    const interior = block({ id: 'interior', seq: 3, lines: 2, content: 'X\nY\n' })
    expect(recollapsePastes('X\nY\nafter', [interior])).toBe(`${formatToken(interior)}after`)
  })

  test('recollapses multiple blocks in document order and claims non-overlapping matches', () => {
    const outer = block({ id: 'outer', seq: 1, lines: 1, content: 'AAABBB' })
    const inner = block({ id: 'inner', seq: 2, lines: 1, content: 'AAA' })
    expect(recollapsePastes('AAABBB then AAA', [outer, inner])).toBe(
      `${formatToken(outer)} then ${formatToken(inner)}`
    )

    const one = block({ id: 'one', seq: 1, lines: 1, content: 'AAA' })
    const two = block({ id: 'two', seq: 2, lines: 1, content: 'BBB' })
    expect(recollapsePastes('x AAA y BBB z', [two, one])).toBe(
      `x ${formatToken(one)} y ${formatToken(two)} z`
    )
  })

  test('assigns repeated identical paste contents to distinct block tokens', () => {
    const first = block({ id: 'first-copy', seq: 1, lines: 3, content: 'A\nB\nC' })
    const second = block({ id: 'second-copy', seq: 2, lines: 3, content: first.content })

    expect(recollapsePastes('before A\nB\nC middle A\nB\nC after', [first, second])).toBe(
      `before ${formatToken(first)} middle ${formatToken(second)} after`
    )
  })

  test('leaves unmatched content alone and replaces a large paste with a small marker', () => {
    const paste = block({ id: 'large', seq: 7, lines: 30_001, content: 'x\n'.repeat(30_000) })
    expect(recollapsePastes('nothing here', [paste])).toBe('nothing here')
    expect(recollapsePastes(paste.content, [paste])).toBe(formatToken(paste))
    expect(formatToken(paste).length).toBeLessThan(64)
  })

  test('strips only trailing blank-line runs that include a newline', () => {
    expect(stripTrailingBlankLines('just one line\n\n\n')).toBe('just one line')
    expect(stripTrailingBlankLines('hello world\n')).toBe('hello world')
    expect(stripTrailingBlankLines('line1\r\nline2\r\n\t  ')).toBe('line1\r\nline2')
    expect(stripTrailingBlankLines('trailing spaces   ')).toBe('trailing spaces   ')
    expect(stripTrailingBlankLines('line1\n\nline2')).toBe('line1\n\nline2')
    expect(stripTrailingBlankLines('\n\n')).toBe('')
  })
})
