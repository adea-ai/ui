import { describe, expect, test } from 'bun:test'

import { formatBytes, formatReleaseDate, plainTextFromMarkdown } from '../src/lib/version-notes'

/**
 * The text a reader sees in the update dialog. `version-notes.test.ts` pins the date zone in a
 * subprocess; these hold the in-process behaviour of all three helpers.
 */
describe('plainTextFromMarkdown', () => {
  test('unwraps links and images to their words before emphasis runs', () => {
    expect(plainTextFromMarkdown('See [the notes](https://example.com/a_b_c) now')).toBe(
      'See the notes now'
    )
    expect(plainTextFromMarkdown('![a logo](https://example.com/l.png) Adea')).toBe('a logo Adea')
  })

  test('strips heading, quote, rule and list markers and keeps the words', () => {
    const markdown = ['## Fixes', '> careful', '---', '- one', '* two', '+ three', '1. four'].join(
      '\n'
    )
    expect(plainTextFromMarkdown(markdown)).toBe(
      ['Fixes', 'careful', '', '• one', '• two', '• three', 'four'].join('\n')
    )
  })

  test('unwraps code, bold and italic spans without eating the surrounding text', () => {
    expect(
      plainTextFromMarkdown('Use `bun test` for **speed** and __safety__, *always* _ok_')
    ).toBe('Use bun test for speed and safety, always ok')
  })

  test('drops code fences, normalises CRLF and collapses blank runs', () => {
    expect(plainTextFromMarkdown('a\r\n\r\n\r\n\r\n```ts\nconst x = 1\n```\nb  ')).toBe(
      'a\n\nconst x = 1\nb'
    )
  })

  test('an empty note stays empty', () => {
    expect(plainTextFromMarkdown('   \n ')).toBe('')
  })
})

describe('formatBytes', () => {
  test('shows bytes below one kilobyte as whole bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  test('scales through kB, MB and GB, with one decimal under ten and none above', () => {
    expect(formatBytes(1024)).toBe('1.0 kB')
    expect(formatBytes(1536)).toBe('1.5 kB')
    expect(formatBytes(12.4 * 1024 * 1024)).toBe('12 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB')
  })

  test('never scales past GB', () => {
    expect(formatBytes(2048 * 1024 ** 3)).toBe('2048 GB')
  })

  test('a size that is not a size reads as a dash, not a number', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatReleaseDate', () => {
  test('no date is no text', () => {
    expect(formatReleaseDate(null)).toBeNull()
    expect(formatReleaseDate('')).toBeNull()
  })

  test('a value that cannot be parsed is shown as written', () => {
    expect(formatReleaseDate('next Tuesday')).toBe('next Tuesday')
  })

  test('a date-only value names the same calendar day wherever it is read', () => {
    const text = formatReleaseDate('2026-09-24')
    expect(text).toContain('24')
    expect(text).toContain('2026')
  })

  test('a full timestamp is formatted as an instant', () => {
    const text = formatReleaseDate('2026-09-24T12:00:00Z')
    expect(text).toContain('2026')
    expect(text).not.toBe('2026-09-24T12:00:00Z')
  })
})
