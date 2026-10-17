import { describe, expect, test } from 'bun:test'
import {
  boundLines,
  classifyFrame,
  dedentLines,
  describeFrameGroup,
  frameLocation,
  groupStackEntries,
  parseStackTrace,
  splitLocation,
  STACK_MAX_LINES,
  type StackEntry,
} from './parse-stack-trace'

const node = `TypeError: Cannot read properties of undefined (reading 'id')
    at getRow (/repo/src/lib/keyed-rows.ts:42:17)
    at Array.map (<anonymous>)
    at render (/repo/src/app.tsx:10:5)
    at Object.<anonymous> (/repo/node_modules/solid-js/dist/solid.js:812:20)
    at runUpdates (/repo/node_modules/solid-js/dist/solid.js:900:3)
    at async Promise.all (index 0)
    at node:internal/process/task_queues:95:5
    at new Foo (file:///repo/src/foo.ts:3:9)
    at C:\\repo\\src\\win.ts:7:1`

const python = `Traceback (most recent call last):
  File "/app/main.py", line 12, in <module>
    run()
  File "/usr/lib/python3.12/site-packages/click/core.py", line 1157, in __call__
    return self.main(*args, **kwargs)
  File "/usr/lib/python3.12/json/decoder.py", line 355, in raw_decode
    raise JSONDecodeError("Expecting value", s, err.value) from None
json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)`

const rust = `thread 'main' panicked at src/main.rs:5:9:
called \`Option::unwrap()\` on a \`None\` value
stack backtrace:
   0: rust_begin_unwind
             at /rustc/abc123/library/std/src/panicking.rs:645:5
   1: core::panicking::panic_fmt
             at /rustc/abc123/library/core/src/panicking.rs:72:14
   2: demo::main
             at ./src/main.rs:5:9
   3: std::rt::lang_start::{{closure}}
   4: tokio::runtime::task::harness::Harness<T,S>::poll
             at /home/me/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tokio-1.40.0/src/runtime/task/harness.rs:155:9
note: Some details are omitted, run with \`RUST_BACKTRACE=full\` for a verbose backtrace.`

/** Every input line must still be somewhere in the output. */
function allText(parsed: ReturnType<typeof parseStackTrace>): string {
  const lines: string[] = []
  if (parsed.header) {
    const { type, message } = parsed.header
    lines.push(type ? `${type}: ${message}` : message)
  }
  for (const entry of parsed.entries) {
    if (entry.type === 'text') lines.push(entry.text)
    else lines.push(entry.frame.raw, ...(entry.frame.detail ?? []))
  }
  return lines.join('\n')
}

describe('parseStackTrace: V8', () => {
  const parsed = parseStackTrace(node)

  test('detects the format and lifts the header', () => {
    expect(parsed.format).toBe('v8')
    expect(parsed.header).toEqual({
      type: 'TypeError',
      message: "Cannot read properties of undefined (reading 'id')",
    })
  })

  test('reads function, file, line and column', () => {
    expect(parsed.frames[0]).toMatchObject({
      function: 'getRow',
      file: '/repo/src/lib/keyed-rows.ts',
      line: 42,
      column: 17,
      kind: 'first-party',
    })
  })

  test('keeps runtime annotations as frames with no file', () => {
    expect(parsed.frames[1]).toMatchObject({ function: 'Array.map', kind: 'internal' })
    expect(parsed.frames[1]!.file).toBeUndefined()
    expect(parsed.frames[5]).toMatchObject({ function: 'Promise.all', async: true })
  })

  test('classifies dependencies, runtime and first-party frames', () => {
    expect(parsed.frames.map((frame) => frame.kind)).toEqual([
      'first-party',
      'internal',
      'first-party',
      'dependency',
      'dependency',
      'internal',
      'internal',
      'first-party',
      'first-party',
    ])
  })

  test('handles a bare location, new, file URLs and Windows paths', () => {
    expect(parsed.frames[6]).toMatchObject({ file: 'node:internal/process/task_queues', line: 95 })
    expect(parsed.frames[7]).toMatchObject({ function: 'new Foo', file: 'file:///repo/src/foo.ts' })
    expect(parsed.frames[8]).toMatchObject({ file: 'C:\\repo\\src\\win.ts', line: 7, column: 1 })
  })

  test('keeps every line', () => {
    expect(allText(parsed).split('\n').length).toBe(node.split('\n').length)
  })

  test('a multi-line message and CRLF input', () => {
    const crlf = 'Error: first\r\nsecond line\r\n    at fn (/a.js:1:1)\r\n'
    const result = parseStackTrace(crlf)
    expect(result.header).toEqual({ type: 'Error', message: 'first\nsecond line' })
    expect(result.frames[0]!.raw).toBe('at fn (/a.js:1:1)')
  })

  test('source context printed above the error stays as text', () => {
    const result = parseStackTrace(
      '/repo/a.js:3\n  throw new Error("x")\n  ^\n\nError: x\n    at f (/repo/a.js:3:9)'
    )
    expect(result.header).toEqual({ type: 'Error', message: 'x' })
    expect(result.entries.filter((entry) => entry.type === 'text').map((e) => e.text)).toEqual([
      '/repo/a.js:3',
      '  throw new Error("x")',
      '  ^',
      '',
    ])
  })

  test('prose that starts with "at" is not a frame', () => {
    const result = parseStackTrace(
      'Error: x\nat the end of the day (we think) it works\n    at f (/a.js:1:1)'
    )
    expect(result.frames.length).toBe(1)
    // It sits in the header block above the first frame, so it is part of the message.
    expect(result.header?.message).toContain('at the end of the day (we think) it works')
  })

  test('a cause chain keeps its separators as text', () => {
    const result = parseStackTrace(
      'Error: outer\n    at a (/a.js:1:1)\n[cause]: Error: inner\n    at b (/b.js:2:2)'
    )
    expect(result.frames.length).toBe(2)
    expect(
      result.entries.some((e) => e.type === 'text' && e.text === '[cause]: Error: inner')
    ).toBe(true)
  })
})

describe('parseStackTrace: Python', () => {
  const parsed = parseStackTrace(python)

  test('detects the format and takes the header from the last line', () => {
    expect(parsed.format).toBe('python')
    expect(parsed.header).toEqual({
      type: 'json.decoder.JSONDecodeError',
      message: 'Expecting value: line 1 column 1 (char 0)',
    })
  })

  test('reads frames and attaches the source line as detail', () => {
    expect(parsed.frames[0]).toMatchObject({
      function: '<module>',
      file: '/app/main.py',
      line: 12,
      kind: 'first-party',
      detail: ['    run()'],
    })
  })

  test('classifies site-packages as a dependency and the stdlib as internal', () => {
    expect(parsed.frames.map((frame) => frame.kind)).toEqual([
      'first-party',
      'dependency',
      'internal',
    ])
  })

  test('keeps the traceback line and everything else', () => {
    expect(parsed.entries[0]).toEqual({ type: 'text', text: 'Traceback (most recent call last):' })
    expect(allText(parsed).split('\n').length).toBe(python.split('\n').length)
  })

  test('a frame with no function, and an exception with no message', () => {
    const result = parseStackTrace('  File "<stdin>", line 1\nKeyboardInterrupt')
    expect(result.frames[0]).toMatchObject({ file: '<stdin>', line: 1, kind: 'internal' })
    expect(result.frames[0]!.function).toBeUndefined()
    expect(result.header).toEqual({ type: 'KeyboardInterrupt', message: '' })
  })

  test('a trailing line that is not an exception is left in place', () => {
    const result = parseStackTrace(
      '  File "/a.py", line 1, in f\n    f()\n[Previous line repeated 996 more times]'
    )
    expect(result.header).toBeUndefined()
    expect(result.entries.at(-1)).toEqual({
      type: 'text',
      text: '[Previous line repeated 996 more times]',
    })
  })
})

describe('parseStackTrace: Rust', () => {
  const parsed = parseStackTrace(rust)

  test('detects the format and reads the panic header', () => {
    expect(parsed.format).toBe('rust')
    expect(parsed.header).toEqual({
      type: "thread 'main' panicked",
      message: 'called `Option::unwrap()` on a `None` value',
      location: 'src/main.rs:5:9',
    })
  })

  test('attaches the location line to its frame', () => {
    expect(parsed.frames[2]).toMatchObject({
      function: 'demo::main',
      file: './src/main.rs',
      line: 5,
      column: 9,
      kind: 'first-party',
    })
    expect(parsed.frames[2]!.raw).toContain('at ./src/main.rs:5:9')
  })

  test('classifies the standard library, registry crates and frames with no path', () => {
    expect(parsed.frames.map((frame) => frame.kind)).toEqual([
      'internal',
      'internal',
      'first-party',
      'internal',
      'dependency',
    ])
  })

  test('keeps the unrecognised lines and every frame', () => {
    expect(parsed.entries.at(-1)).toMatchObject({ type: 'text' })
    expect(parsed.entries.some((e) => e.type === 'text' && e.text === 'stack backtrace:')).toBe(
      true
    )
    expect(parsed.frames.length).toBe(5)
  })

  test('the older single-line panic format', () => {
    const result = parseStackTrace(
      "thread 'main' panicked at 'explicit panic', src/main.rs:2:5\n   0: demo::main\n             at ./src/main.rs:2:5"
    )
    expect(result.header).toEqual({
      type: "thread 'main' panicked",
      message: 'explicit panic',
      location: 'src/main.rs:2:5',
    })
  })

  test('a numbered list is not a backtrace without Rust context', () => {
    expect(parseStackTrace('1: first thing\n2: second thing').format).toBe('unknown')
  })

  test('backtrace lines with addresses', () => {
    const result = parseStackTrace(
      "thread 'x' panicked at src/a.rs:1:1:\nboom\n   0:     0x55d0c0a1b2c3 - demo::run\n                               at /w/src/a.rs:1:1"
    )
    expect(result.frames[0]).toMatchObject({ function: 'demo::run', file: '/w/src/a.rs' })
  })
})

describe('parseStackTrace: unknown formats', () => {
  test('falls back to raw text and hides nothing', () => {
    const go = 'goroutine 1 [running]:\nmain.main()\n\t/app/main.go:7 +0x1d\nexit status 2'
    const parsed = parseStackTrace(go)
    expect(parsed.format).toBe('unknown')
    expect(parsed.frames).toEqual([])
    expect(parsed.header).toBeUndefined()
    expect(parsed.entries.map((entry) => (entry as { text: string }).text)).toEqual(go.split('\n'))
  })

  test('empty and whitespace input', () => {
    expect(parseStackTrace('').entries).toEqual([{ type: 'text', text: '' }])
    expect(parseStackTrace('   \n  ').format).toBe('unknown')
  })

  test('never throws on arbitrary text', () => {
    const pieces = [
      'at ',
      '(',
      ')',
      ':',
      'File "',
      '", line ',
      '12',
      '\n',
      ' ',
      '   0: ',
      '::',
      '\r',
      'x',
    ]
    let state = 7
    for (let run = 0; run < 300; run += 1) {
      let text = ''
      for (let i = 0; i < 80; i += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        text += pieces[state % pieces.length]
      }
      expect(() => parseStackTrace(text)).not.toThrow()
    }
  })
})

describe('parseStackTrace: bounds', () => {
  test('a very long line is text and is never run through a pattern', () => {
    const line = `at ${'a'.repeat(100_000)} (/x.js:1:1)`
    const parsed = parseStackTrace(`Error: x\n    ${line}`)
    expect(parsed.frames.length).toBe(0)
    expect(allText(parsed)).toContain('a'.repeat(100_000))
  })

  test('pathological input parses in linear time', () => {
    const start = performance.now()
    parseStackTrace(`File "${'"'.repeat(3900)}`)
    parseStackTrace(`at ${'('.repeat(3900)}`)
    parseStackTrace(`${'0:'.repeat(1900)}`)
    expect(performance.now() - start).toBeLessThan(500)
  })

  test('input past the line limit is kept as one trailing text entry', () => {
    const lines = Array.from(
      { length: STACK_MAX_LINES + 50 },
      (_, i) => `    at f${i} (/a.js:${i + 1}:1)`
    )
    const parsed = parseStackTrace(lines.join('\n'))
    expect(parsed.frames.length).toBe(STACK_MAX_LINES)
    const last = parsed.entries.at(-1)!
    expect(last.type).toBe('text')
    expect((last as { text: string }).text.split('\n').length).toBe(50)
  })
})

describe('parseStackTrace: classify option', () => {
  test('lets the host decide whose code a frame is', () => {
    const parsed = parseStackTrace(node, {
      classify: (frame) => (frame.file?.includes('/repo/src/') ? 'dependency' : undefined),
    })
    expect(parsed.frames[0]!.kind).toBe('dependency')
    expect(parsed.frames[3]!.kind).toBe('dependency')
    expect(parsed.frames[1]!.kind).toBe('internal')
  })
})

describe('classifyFrame', () => {
  test('Windows separators are normalised before matching', () => {
    expect(classifyFrame({ raw: '', file: 'C:\\repo\\node_modules\\x\\index.js' }, 'v8')).toBe(
      'dependency'
    )
    expect(
      classifyFrame({ raw: '', file: 'C:\\Python312\\Lib\\site-packages\\x.py' }, 'python')
    ).toBe('dependency')
  })
})

describe('splitLocation', () => {
  test('splits from the right', () => {
    expect(splitLocation('/a/b.ts:3:4')).toEqual({ file: '/a/b.ts', line: 3, column: 4 })
    expect(splitLocation('/a/b.ts:3')).toEqual({ file: '/a/b.ts', line: 3 })
    expect(splitLocation('/a/b.ts')).toEqual({ file: '/a/b.ts' })
    expect(splitLocation('http://localhost:3000/a.js:10:5')).toEqual({
      file: 'http://localhost:3000/a.js',
      line: 10,
      column: 5,
    })
    expect(splitLocation('C:\\a\\b.ts:1:2').file).toBe('C:\\a\\b.ts')
  })

  test('does not eat a path that is only digits after a colon', () => {
    expect(splitLocation(':12')).toEqual({ file: ':12' })
    expect(splitLocation('')).toEqual({ file: '' })
  })
})

describe('groupStackEntries', () => {
  const frames = parseStackTrace(node).entries

  test('folds runs of two or more dependency and runtime frames', () => {
    const blocks = groupStackEntries(frames)
    // The lone runtime frame at index 1 stays a frame; frames 3–6 are one run.
    expect(blocks.map((block) => block.type)).toEqual([
      'frame',
      'frame',
      'frame',
      'group',
      'frame',
      'frame',
    ])
    const group = blocks[3]!
    expect(group.type === 'group' && group.frames.length).toBe(4)
  })

  test('does nothing when collapsing is off or nothing is first-party', () => {
    expect(groupStackEntries(frames, false)).toEqual(frames)
    const none = parseStackTrace(
      'Error\n    at a (/x/node_modules/a.js:1:1)\n    at b (/x/node_modules/b.js:1:1)'
    )
    expect(groupStackEntries(none.entries).some((block) => block.type === 'group')).toBe(false)
  })

  test('text entries break a run', () => {
    const entries: StackEntry[] = [
      { type: 'frame', frame: { raw: 'a', kind: 'first-party' } },
      { type: 'frame', frame: { raw: 'b', kind: 'dependency' } },
      { type: 'text', text: 'Caused by' },
      { type: 'frame', frame: { raw: 'c', kind: 'dependency' } },
      { type: 'frame', frame: { raw: 'd', kind: 'dependency' } },
    ]
    expect(groupStackEntries(entries).map((block) => block.type)).toEqual([
      'frame',
      'frame',
      'text',
      'group',
    ])
  })
})

const frame = (kind: 'dependency' | 'internal') => ({ raw: '', kind }) as const

describe('describeFrameGroup', () => {
  test('names what the group holds', () => {
    expect(describeFrameGroup([frame('dependency'), frame('dependency')])).toBe(
      '2 dependency frames'
    )
    expect(describeFrameGroup([frame('internal'), frame('internal'), frame('internal')])).toBe(
      '3 runtime frames'
    )
    expect(describeFrameGroup([frame('dependency'), frame('internal')])).toBe(
      '2 dependency and runtime frames'
    )
    expect(describeFrameGroup([frame('internal')])).toBe('1 runtime frame')
  })
})

describe('frameLocation', () => {
  test('uses whichever parts exist', () => {
    expect(frameLocation({ raw: '', kind: 'first-party', file: 'a.ts', line: 3, column: 4 })).toBe(
      'a.ts:3:4'
    )
    expect(frameLocation({ raw: '', kind: 'first-party', file: 'a.ts', line: 3 })).toBe('a.ts:3')
    expect(frameLocation({ raw: '', kind: 'first-party', file: 'a.ts' })).toBe('a.ts')
    expect(frameLocation({ raw: '', kind: 'internal' })).toBeUndefined()
  })
})

describe('dedentLines', () => {
  test('removes the shared indentation and keeps the relative one', () => {
    expect(dedentLines(['    if x:', '        run()', ''])).toEqual(['if x:', '    run()', ''])
  })

  test('leaves blank-only input alone and never over-trims a shallower line', () => {
    expect(dedentLines(['  ', ''])).toEqual(['  ', ''])
    expect(dedentLines(['\t\ta', '\tb'])).toEqual(['\ta', 'b'])
  })
})

describe('boundLines', () => {
  test('returns everything that fits and counts nothing omitted', () => {
    expect(boundLines(['a', 'bb'], 10, 100)).toEqual({
      lines: ['a', 'bb'],
      omittedLines: 0,
      omittedChars: 0,
    })
    expect(boundLines([], 10, 100)).toEqual({ lines: [], omittedLines: 0, omittedChars: 0 })
  })

  test('stops at the line bound and counts the rest', () => {
    expect(boundLines(['a', 'bb', 'ccc', 'dddd'], 2, 100)).toEqual({
      lines: ['a', 'bb'],
      omittedLines: 2,
      omittedChars: 7,
    })
  })

  test('cuts the line that crosses the character bound and counts what it lost', () => {
    expect(boundLines(['aaaa', 'bbbb', 'cc'], 10, 6)).toEqual({
      lines: ['aaaa', 'bb'],
      omittedLines: 1,
      omittedChars: 4,
    })
  })

  test('a budget spent exactly shows no empty line', () => {
    expect(boundLines(['aaaa', 'bb'], 10, 4)).toEqual({
      lines: ['aaaa'],
      omittedLines: 1,
      omittedChars: 2,
    })
  })

  test('ten thousand lines of four thousand characters stay bounded and fast', () => {
    const lines = Array.from({ length: 9_996 }, () => 'x'.repeat(4_000))
    const started = performance.now()
    const bounded = boundLines(lines, 40, 10_000)
    expect(performance.now() - started).toBeLessThan(100)
    expect(bounded.lines.join('').length).toBe(10_000)
    expect(bounded.lines).toHaveLength(3)
    expect(bounded.omittedLines).toBe(9_993)
    expect(bounded.lines.join('').length + bounded.omittedChars).toBe(9_996 * 4_000)
  })
})

describe('linear parser compatibility with JavaScript character classes', () => {
  for (const separator of ['\r', '\u2028', '\u2029']) {
    test(`Python rejects interior line terminator U+${separator.charCodeAt(0).toString(16)}`, () => {
      for (const input of [
        `  File "src/left${separator}right.py", line 7, in run`,
        `  File "src/main.py", line 7, in left${separator}right`,
      ]) {
        const parsed = parseStackTrace(input)
        expect(parsed.frames).toEqual([])
        expect(parsed.entries).toContainEqual({ type: 'text', text: input })
      }
    })

    test(`Rust rejects interior line terminator U+${separator.charCodeAt(0).toString(16)}`, () => {
      for (const suffix of [
        `'left${separator}right', src/main.rs:7:1`,
        `'message', src/left${separator}right.rs:7:1`,
      ]) {
        const parsed = parseStackTrace(
          `thread 'main' panicked at ${suffix}\nstack backtrace:\n  0: demo::main`
        )
        expect(parsed.format).toBe('rust')
        expect(parsed.header?.message).toBe('')
        expect(parsed.header?.location).toBe(suffix)
      }
    })
  }

  for (const whitespace of [
    '\t',
    '\v',
    '\f',
    ' ',
    '\u00a0',
    '\u1680',
    ...Array.from({ length: 11 }, (_, index) => String.fromCharCode(0x2000 + index)),
    '\u202f',
    '\u205f',
    '\u3000',
    '\ufeff',
  ]) {
    test(`Rust last-separator selection excludes JS whitespace U+${whitespace.charCodeAt(0).toString(16)}`, () => {
      const location = `src/main.rs:7:1', ${whitespace}not-a-location`
      const parsed = parseStackTrace(
        `thread 'main' panicked at 'message', ${location}\nstack backtrace:\n  0: demo::main`
      )
      expect(parsed.header?.message).toBe('message')
      expect(parsed.header?.location).toBe(location)
    })
  }

  for (const character of ['\u0085', '\u180e']) {
    test(`Rust keeps non-JS-whitespace U+${character.charCodeAt(0).toString(16)} as a location head`, () => {
      const parsed = parseStackTrace(
        `thread 'main' panicked at 'message', src/main.rs:7:1', ${character}location\nstack backtrace:\n  0: demo::main`
      )
      expect(parsed.header?.message).toBe("message', src/main.rs:7:1")
      expect(parsed.header?.location).toBe(`${character}location`)
    })
  }
})
