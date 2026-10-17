import { describe, expect, test } from 'bun:test'
import { formatToolValue, TOOL_VALUE_MAX_CHARS } from './format-tool-value'

describe('formatToolValue', () => {
  test('pretty-prints plain JSON data', () => {
    const result = formatToolValue({ path: 'src/app.tsx', lines: [1, 2], ok: true, none: null })
    expect(result.language).toBe('json')
    expect(result.truncated).toBe(false)
    expect(JSON.parse(result.text)).toEqual({
      path: 'src/app.tsx',
      lines: [1, 2],
      ok: true,
      none: null,
    })
    expect(result.text).toContain('\n  "path": "src/app.tsx"')
  })

  test('writes empty containers compactly', () => {
    expect(formatToolValue({}).text).toBe('{}')
    expect(formatToolValue([]).text).toBe('[]')
    expect(formatToolValue({ a: [], b: {} }).text).toBe('{\n  "a": [],\n  "b": {}\n}')
  })

  test('returns a string as given: unquoted, unparsed, language text', () => {
    const json = '{"id": 12345678901234567890}'
    expect(formatToolValue(json)).toEqual({ text: json, language: 'text', truncated: false })
    expect(formatToolValue('line 1\nline 2').text).toBe('line 1\nline 2')
  })

  test('says what undefined, functions and symbols are instead of throwing', () => {
    expect(formatToolValue(undefined)).toEqual({
      text: 'undefined',
      language: 'text',
      truncated: false,
    })
    expect(formatToolValue(function readFile() {}).text).toBe('[Function readFile]')
    expect(formatToolValue(Symbol('s')).text).toBe('Symbol(s)')
  })

  test('does not throw on a circular reference and marks it', () => {
    const value: Record<string, unknown> = { name: 'node' }
    value['self'] = value
    value['list'] = [value]
    const result = formatToolValue(value)
    expect(result.text).toContain('"self": "[Circular]"')
    expect(result.text).toContain('"[Circular]"')
    expect(result.truncated).toBe(false)
  })

  test('does not mistake a repeated, non-circular reference for a cycle', () => {
    const shared = { id: 1 }
    const result = formatToolValue({ a: shared, b: shared })
    expect(result.text).not.toContain('Circular')
    expect(JSON.parse(result.text)).toEqual({ a: { id: 1 }, b: { id: 1 } })
  })

  test('writes BigInt as a bigint, at the top level and nested', () => {
    expect(formatToolValue(12n).text).toBe('12n')
    expect(formatToolValue({ big: 9007199254740993n }).text).toBe(
      '{\n  "big": 9007199254740993n\n}'
    )
  })

  test('keeps values JSON would coerce to null distinguishable', () => {
    const text = formatToolValue({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: undefined }).text
    expect(text).toContain('"a": NaN')
    expect(text).toContain('"b": Infinity')
    expect(text).toContain('"c": undefined')
  })

  test('survives a getter that throws', () => {
    const value = {
      ok: 1,
      get broken(): number {
        throw new Error('nope')
      },
    }
    const result = formatToolValue(value)
    expect(result.text).toContain('"ok": 1')
    expect(result.text).toContain('"broken": "[Unreadable]"')
  })

  test('summarises errors, maps, sets, dates and binary data', () => {
    const result = formatToolValue({
      error: new TypeError('bad input'),
      map: new Map([['k', 1]]),
      set: new Set([1, 2]),
      at: new Date('2026-10-15T00:00:00.000Z'),
      bytes: new Uint8Array(1024),
    })
    expect(result.text).toContain('"name": "TypeError"')
    expect(result.text).toContain('"message": "bad input"')
    expect(result.text).toContain('"k"')
    expect(result.text).toContain('"at": "2026-10-15T00:00:00.000Z"')
    expect(result.text).toContain('[Uint8Array: 1,024 bytes]')
  })

  test('cuts a very long string and says so', () => {
    const result = formatToolValue('x'.repeat(100_000), { maxChars: 50 })
    expect(result.text).toBe('x'.repeat(50))
    expect(result.truncated).toBe(true)
  })

  test('a string exactly at the limit is whole', () => {
    expect(formatToolValue('abc', { maxChars: 3 })).toEqual({
      text: 'abc',
      language: 'text',
      truncated: false,
    })
  })

  test('stops walking a huge structure once the budget is spent', () => {
    const huge = Array.from({ length: 1_000_000 }, (_, index) => ({ index, label: 'row' }))
    const started = performance.now()
    const result = formatToolValue(huge, { maxChars: 500 })
    expect(performance.now() - started).toBeLessThan(500)
    expect(result.text.length).toBe(500)
    expect(result.truncated).toBe(true)
    expect(result.language).toBe('json')
  })

  test('does not spin on a sparse array', () => {
    const sparse: unknown[] = []
    sparse.length = 50_000_000
    const result = formatToolValue(sparse, { maxChars: 100 })
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(100)
  })

  test('bounds one enormous string inside an object', () => {
    const result = formatToolValue({ blob: 'y'.repeat(5_000_000) }, { maxChars: 200 })
    expect(result.text.length).toBe(200)
    expect(result.truncated).toBe(true)
  })

  test('writes deep nesting as a marker, not a stack overflow', () => {
    let value: unknown = 'leaf'
    for (let depth = 0; depth < 5_000; depth += 1) value = { next: value }
    const result = formatToolValue(value, { maxChars: 100_000 })
    expect(result.text).toContain('"[Object]"')
    expect(result.truncated).toBe(false)
  })

  test('uses the default budget and tolerates a nonsense one', () => {
    expect(formatToolValue('z'.repeat(TOOL_VALUE_MAX_CHARS + 1)).truncated).toBe(true)
    expect(formatToolValue('abc', { maxChars: Number.NaN }).text).toBe('abc')
    expect(formatToolValue('abc', { maxChars: -5 })).toEqual({
      text: '',
      language: 'text',
      truncated: true,
    })
  })

  test('survives a proxy whose traps throw', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('trap')
        },
      }
    )
    const result = formatToolValue(hostile)
    expect(result.text).toBe('[Unreadable]')
  })
})
