import { describe, expect, test } from 'bun:test'
import {
  boundText,
  safeSourceUrl,
  sourceHost,
  sourceTitle,
  sourcesLabel,
  SOURCE_TITLE_LIMIT,
} from './source'

// Direction controls built from code points, so the file holds no hidden characters.
const RLO = String.fromCharCode(0x202e)
const LRI = String.fromCharCode(0x2066)
const PDI = String.fromCharCode(0x2069)

describe('safeSourceUrl', () => {
  test('accepts http, https and mailto', () => {
    expect(safeSourceUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(safeSourceUrl('http://example.com')).toBe('http://example.com')
    expect(safeSourceUrl('mailto:team@example.com')).toBe('mailto:team@example.com')
  })

  test('refuses script, data, file and relative addresses', () => {
    for (const hostile of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
      '//example.com/protocol-relative',
      '/relative/path',
      'example.com',
      '',
    ]) {
      expect(safeSourceUrl(hostile)).toBeUndefined()
    }
  })

  test('refuses whitespace and control characters smuggled into the address', () => {
    expect(safeSourceUrl('java\nscript:alert(1)')).toBeUndefined()
    expect(safeSourceUrl('https://example.com/\u0000')).toBeUndefined()
    expect(safeSourceUrl('https://example.com/a b')).toBeUndefined()
  })

  test('refuses embedded credentials, which make the shown host a lie', () => {
    expect(safeSourceUrl('https://trusted.example@evil.example/')).toBeUndefined()
    expect(safeSourceUrl('https://user:pw@example.com/')).toBeUndefined()
  })

  test('refuses an absurdly long value', () => {
    expect(safeSourceUrl(`https://example.com/${'a'.repeat(5000)}`)).toBeUndefined()
  })

  test('absent stays absent', () => {
    expect(safeSourceUrl(undefined)).toBeUndefined()
  })
})

describe('sourceHost', () => {
  test('is the parsed hostname', () => {
    expect(sourceHost('https://docs.example.com:8443/a')).toBe('docs.example.com')
  })

  test('shows an internationalised host in its punycode form', () => {
    expect(sourceHost('https://exаmple.com/')).toBe('xn--exmple-4nf.com')
  })

  test('shows the address of a mailto source', () => {
    expect(sourceHost('mailto:team@example.com')).toBe('team@example.com')
  })

  test('has no host for an unsafe or missing URL', () => {
    expect(sourceHost('javascript:alert(1)')).toBeUndefined()
    expect(sourceHost(undefined)).toBeUndefined()
  })
})

describe('boundText', () => {
  test('leaves short text alone', () => {
    expect(boundText('A title', 40)).toBe('A title')
  })

  test('clips with an ellipsis', () => {
    expect(boundText('x'.repeat(1000), 20)).toBe(`${'x'.repeat(20)}…`)
  })

  test('collapses newlines and runs of spaces', () => {
    expect(boundText('one\n\n  two\t three', 40)).toBe('one two three')
  })

  test('removes direction overrides and control characters', () => {
    expect(boundText(`safe${RLO}exe.txt\u0000`, 40)).toBe('safeexe.txt')
    expect(boundText(`a${LRI}b${PDI}c`, 40)).toBe('abc')
  })

  test('does not split a surrogate pair', () => {
    const out = boundText('😀'.repeat(30), 5)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain(String.fromCharCode(0xfffd))
    expect(Array.from(out.slice(0, -1)).every((char) => char === '😀')).toBe(true)
  })

  test('survives a multi-megabyte value', () => {
    expect(boundText('y'.repeat(5_000_000), 10)).toBe(`${'y'.repeat(10)}…`)
  })
})

describe('sourcesLabel', () => {
  test('is singular for one and plural otherwise', () => {
    expect(sourcesLabel(1)).toBe('Used 1 source')
    expect(sourcesLabel(2)).toBe('Used 2 sources')
    expect(sourcesLabel(200)).toBe('Used 200 sources')
  })
})

describe('sourceTitle', () => {
  test('prefers the title, then the host, then a placeholder', () => {
    expect(sourceTitle({ title: 'Docs', url: 'https://example.com' })).toBe('Docs')
    expect(sourceTitle({ title: '  ', url: 'https://example.com' })).toBe('example.com')
    expect(sourceTitle({ title: '' })).toBe('Untitled source')
  })

  test('bounds a hostile title', () => {
    expect(sourceTitle({ title: 'z'.repeat(10_000) }).length).toBe(SOURCE_TITLE_LIMIT + 1)
  })
})
