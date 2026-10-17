import { describe, expect, test } from 'bun:test'
import {
  ansi256ToColor,
  ansiLineText,
  createAnsiParser,
  isPlainStyle,
  nearestAnsiColor,
  parseAnsi,
  resolveColors,
  type AnsiLine,
} from './ansi'

const ESC = '\u001b'
const BEL = '\u0007'

/** Lines as plain text, which is what most of these cases are about. */
const text = (input: string, options?: Parameters<typeof parseAnsi>[1]) =>
  parseAnsi(input, options).map(ansiLineText)

/** Feed a string one chunk of `size` characters at a time. */
function chunked(input: string, size: number): AnsiLine[] {
  const parser = createAnsiParser()
  for (let i = 0; i < input.length; i += size) parser.write(input.slice(i, i + size))
  const open = parser.openLine()
  return open ? [...parser.lines, open] : [...parser.lines]
}

/** A small deterministic generator, so a failure names a reproducible seed. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** Anything but tab from the control range, plus C1 and the bidirectional controls. */
function hasForbiddenCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (
      (code < 0x20 && code !== 0x09) ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return true
    }
  }
  return false
}

describe('parseAnsi: lines', () => {
  test('splits on newlines and keeps empty lines', () => {
    expect(text('a\nb\n\nc')).toEqual(['a', 'b', '', 'c'])
  })

  test('a trailing newline does not add an empty line', () => {
    expect(text('a\nb\n')).toEqual(['a', 'b'])
    expect(text('')).toEqual([])
    expect(text('\n')).toEqual([''])
  })

  test('CRLF is one line break and does not overwrite', () => {
    expect(text('one\r\ntwo\r\n')).toEqual(['one', 'two'])
  })

  test('tab is kept, other control characters are dropped', () => {
    expect(text('a\tb\u0000c\u0007d\u007fe\u000bf')).toEqual(['a\tbcdef'])
  })

  test('bidirectional overrides and line separators are dropped', () => {
    expect(text('a‮b⁦c⁩d e')).toEqual(['abcde'])
  })

  test('keeps non-ASCII text intact', () => {
    expect(text('héllo 世界 😀')).toEqual(['héllo 世界 😀'])
  })
})

describe('parseAnsi: carriage return and backspace', () => {
  test('a progress bar overwrites its own line', () => {
    expect(text('10%\r50%\r100%\ndone')).toEqual(['100%', 'done'])
  })

  test('a shorter redraw leaves the tail of the longer text, like a terminal', () => {
    expect(text('hello world\rbye')).toEqual(['byelo world'])
  })

  test('erase in line after a return clears the old text', () => {
    expect(text('downloading 99%\r\u001b[Kdone')).toEqual(['done'])
    expect(text(`downloading 99%\r${ESC}[2Kdone`)).toEqual(['done'])
  })

  test('erase to end from mid-line, and to start', () => {
    expect(text(`abcdef\b\b\b${ESC}[K`)).toEqual(['abc'])
    expect(text(`abcdef\b\b${ESC}[1K`)).toEqual(['     f'])
  })

  test('backspace steps back and the next character overwrites', () => {
    expect(text('abc\bX')).toEqual(['abX'])
    expect(text('\b\bX')).toEqual(['X'])
  })

  test('a trailing return with nothing after keeps the text', () => {
    expect(text('spinner\r')).toEqual(['spinner'])
  })

  test('overwrites keep the style of the new text', () => {
    const [line] = parseAnsi(`aaa\r${ESC}[31mb`)
    expect(line!.segments.map((s) => [s.text, s.style.fg])).toEqual([
      ['b', 1],
      ['aa', undefined],
    ])
  })
})

describe('parseAnsi: SGR', () => {
  test('applies colours, attributes and reset', () => {
    const [line] = parseAnsi(`plain ${ESC}[1;31mred bold${ESC}[0m after`)
    expect(line!.segments.map((s) => s.text)).toEqual(['plain ', 'red bold', ' after'])
    expect(line!.segments[1]!.style).toEqual({ fg: 1, bold: true })
    expect(isPlainStyle(line!.segments[2]!.style)).toBe(true)
  })

  test('an empty parameter list is a reset', () => {
    const [line] = parseAnsi(`${ESC}[32mgreen${ESC}[mnone`)
    expect(line!.segments[1]!.style).toEqual({})
  })

  test('maps bright foreground and background to 8–15', () => {
    const [line] = parseAnsi(`${ESC}[91;102mx`)
    expect(line!.segments[0]!.style).toEqual({ fg: 9, bg: 10 })
  })

  test('dim, italic, underline, strike and inverse turn on and off', () => {
    const [on] = parseAnsi(`${ESC}[2;3;4;7;9mx`)
    expect(on!.segments[0]!.style).toEqual({
      dim: true,
      italic: true,
      underline: true,
      inverse: true,
      strike: true,
    })
    const [off] = parseAnsi(`${ESC}[2;3;4;7;9;22;23;24;27;29mx`)
    expect(off!.segments[0]!.style).toEqual({})
  })

  test('default foreground and background codes clear only their own side', () => {
    const [line] = parseAnsi(`${ESC}[31;42m${ESC}[39mx`)
    expect(line!.segments[0]!.style).toEqual({ bg: 2 })
    const [other] = parseAnsi(`${ESC}[31;42m${ESC}[49mx`)
    expect(other!.segments[0]!.style).toEqual({ fg: 1 })
  })

  test('style persists across lines until it is reset', () => {
    const lines = parseAnsi(`${ESC}[34mone\ntwo${ESC}[0m\nthree`)
    expect(lines[0]!.segments[0]!.style.fg).toBe(4)
    expect(lines[1]!.segments[0]!.style.fg).toBe(4)
    expect(isPlainStyle(lines[2]!.segments[0]!.style)).toBe(true)
  })

  test('blink and conceal are ignored, so output cannot hide itself', () => {
    const [line] = parseAnsi(`${ESC}[5;8mstill visible`)
    expect(line!.segments[0]!.text).toBe('still visible')
    expect(line!.segments[0]!.style).toEqual({})
  })

  test('unknown parameters are skipped without losing their neighbours', () => {
    const [line] = parseAnsi(`${ESC}[31;99;1mx`)
    expect(line!.segments[0]!.style).toEqual({ fg: 1, bold: true })
  })

  test('colon-separated underline styles are an underline unless 0', () => {
    expect(parseAnsi(`${ESC}[4:3mx`)[0]!.segments[0]!.style).toEqual({ underline: true })
    expect(parseAnsi(`${ESC}[4mx${ESC}[4:0my`)[0]!.segments[1]!.style).toEqual({})
  })
})

describe('parseAnsi: extended colours', () => {
  test('256-colour indices below 16 are the palette itself', () => {
    expect(parseAnsi(`${ESC}[38;5;9mx`)[0]!.segments[0]!.style.fg).toBe(9)
    expect(parseAnsi(`${ESC}[48;5;4mx`)[0]!.segments[0]!.style.bg).toBe(4)
  })

  test('cube and grey indices map to the nearest of the sixteen', () => {
    expect(ansi256ToColor(196)).toBe(9) // pure red
    expect(ansi256ToColor(46)).toBe(10) // pure green
    expect(ansi256ToColor(21)).toBe(4) // pure blue is nearer the normal blue than the bright one
    expect(ansi256ToColor(232)).toBe(0) // darkest grey
    expect(ansi256ToColor(255)).toBe(7) // lightest grey
  })

  test('truecolour maps to the nearest, and out-of-range channels are dropped', () => {
    expect(parseAnsi(`${ESC}[38;2;255;10;10mx`)[0]!.segments[0]!.style.fg).toBe(9)
    expect(parseAnsi(`${ESC}[38;2;0;0;0mx`)[0]!.segments[0]!.style.fg).toBe(0)
    expect(parseAnsi(`${ESC}[38;2;999;0;0mx`)[0]!.segments[0]!.style).toEqual({})
  })

  test('colon forms, with and without a colour-space id', () => {
    expect(parseAnsi(`${ESC}[38:2:255:0:0mx`)[0]!.segments[0]!.style.fg).toBe(9)
    expect(parseAnsi(`${ESC}[38:2::255:0:0mx`)[0]!.segments[0]!.style.fg).toBe(9)
    expect(parseAnsi(`${ESC}[48:5:2mx`)[0]!.segments[0]!.style.bg).toBe(2)
  })

  test('a malformed extended colour consumes its operands and nothing else', () => {
    // `38;5` with no index must not turn the following `1` into bold.
    const [line] = parseAnsi(`${ESC}[38;5mx`)
    expect(line!.segments[0]!.style).toEqual({})
    const [truncated] = parseAnsi(`${ESC}[38;2;1;2;1mx`)
    expect(truncated!.segments[0]!.style.bold).toBeUndefined()
    expect(parseAnsi(`${ESC}[38;5;300mx`)[0]!.segments[0]!.style).toEqual({})
  })

  test('underline colour operands are not read as codes', () => {
    const [line] = parseAnsi(`${ESC}[58;2;1;2;3;1mx`)
    expect(line!.segments[0]!.style).toEqual({ bold: true })
  })

  test('nearestAnsiColor clamps and survives NaN', () => {
    expect(nearestAnsiColor(-5, 300, Number.NaN)).toBe(10)
    expect(ansi256ToColor(256)).toBeUndefined()
    expect(ansi256ToColor(-1)).toBeUndefined()
    expect(ansi256ToColor(1.5)).toBeUndefined()
  })
})

describe('parseAnsi: reverse video', () => {
  test('swaps the sides, using the terminal defaults for a missing one', () => {
    expect(resolveColors({ fg: 1, bg: 2 })).toEqual({ fg: 1, bg: 2 })
    expect(resolveColors({ fg: 1, bg: 2, inverse: true })).toEqual({ fg: 2, bg: 1 })
    expect(resolveColors({ inverse: true })).toEqual({ fg: 'default-bg', bg: 'default-fg' })
    expect(resolveColors({ fg: 3, inverse: true })).toEqual({ fg: 'default-bg', bg: 3 })
  })
})

describe('parseAnsi: sequences that are dropped', () => {
  test('cursor movement and private modes leave no text behind', () => {
    expect(text(`a${ESC}[2Ab${ESC}[10;20Hc${ESC}[?25ld${ESC}[?1049he${ESC}[3Jf${ESC}[5Sg`)).toEqual(
      ['abcdefg']
    )
  })

  test('OSC title and hyperlink sequences are dropped with their payload', () => {
    expect(text(`${ESC}]0;evil title${BEL}visible`)).toEqual(['visible'])
    expect(text(`${ESC}]2;title${ESC}\\visible`)).toEqual(['visible'])
    expect(text(`${ESC}]8;;https://example.com${BEL}link${ESC}]8;;${BEL}`)).toEqual(['link'])
  })

  test('OSC 52 clipboard writes are dropped, whatever the payload', () => {
    const payload = btoa('rm -rf /')
    expect(text(`before${ESC}]52;c;${payload}${BEL}after`)).toEqual(['beforeafter'])
    expect(text(`before${ESC}]52;c;${payload}${ESC}\\after`)).toEqual(['beforeafter'])
    expect(text(`before${ESC}]52;c;?${BEL}after`)).toEqual(['beforeafter'])
  })

  test('DCS, SOS, PM and APC strings are dropped', () => {
    for (const introducer of ['P', 'X', '^', '_']) {
      expect(text(`a${ESC}${introducer}payload${ESC}\\b`)).toEqual(['ab'])
    }
  })

  test('an unterminated string ends at the line, so it cannot swallow the rest', () => {
    expect(text(`${ESC}]0;never closed\nnext line`)).toEqual(['', 'next line'])
  })

  test('charset designation and other two-byte escapes are dropped', () => {
    expect(text(`${ESC}(Bplain${ESC}c${ESC}7${ESC}8!`)).toEqual(['plain!'])
    expect(text(`${ESC}#8x`)).toEqual(['x'])
  })

  test('8-bit C1 forms are dropped like their 7-bit equivalents', () => {
    expect(text('a\u009b31mb')).toEqual(['ab'])
    expect(text('a\u009d0;title\u0007b')).toEqual(['ab'])
    expect(text('a\u009d0;title\u009cb')).toEqual(['ab'])
    expect(text('a\u0090data\u009cb')).toEqual(['ab'])
    expect(text('a\u0085b\u0080c')).toEqual(['abc'])
  })

  test('8-bit CSI SGR is dropped, not applied', () => {
    const [line] = parseAnsi('\u009b31mred?')
    expect(line!.segments[0]!.style).toEqual({})
  })

  test('a CSI with an intermediate byte or private marker is not treated as SGR', () => {
    const [line] = parseAnsi(`${ESC}[?1mx${ESC}[1 mx${ESC}[>1mx`)
    expect(line!.segments.every((s) => isPlainStyle(s.style))).toBe(true)
    expect(ansiLineText(line!)).toBe('xxx')
  })
})

describe('parseAnsi: malformed input', () => {
  test('a CSI interrupted by a control character is dropped and the character is read', () => {
    expect(text(`a${ESC}[31\nb`)).toEqual(['a', 'b'])
    expect(text(`a${ESC}[31\u0000b`)).toEqual(['ab'])
  })

  test('a CSI interrupted by another escape starts the new one', () => {
    const [line] = parseAnsi(`${ESC}[3${ESC}[32mx`)
    expect(line!.segments[0]!.style.fg).toBe(2)
  })

  test('a bare ESC before a newline or at the end vanishes', () => {
    expect(text(`a${ESC}\nb`)).toEqual(['a', 'b'])
    expect(text(`a${ESC}`)).toEqual(['a'])
    // `ESC ESC ESC b` is two stray escapes and then the two-byte sequence `ESC b`.
    expect(text(`a${ESC}${ESC}${ESC}b`)).toEqual(['a'])
    expect(text(`a${ESC}${ESC}é`)).toEqual(['aé'])
  })

  test('a CSI with an absurd parameter run is dropped, not stored', () => {
    const long = '1;'.repeat(5000)
    expect(text(`a${ESC}[${long}mb`)).toEqual(['ab'])
    const [line] = parseAnsi(`${ESC}[1;31${long}mb`)
    expect(isPlainStyle(line!.segments[0]!.style)).toBe(true)
  })

  test('non-numeric SGR parameters are ignored', () => {
    const [line] = parseAnsi(`${ESC}[1;999999999999;31mx`)
    expect(line!.segments[0]!.style).toEqual({ bold: true, fg: 1 })
  })
})

describe('createAnsiParser: chunk boundaries', () => {
  const samples = [
    `plain ${ESC}[1;31mred${ESC}[0m end\nsecond ${ESC}[38;2;10;200;30mgreen${ESC}[m\n`,
    `50%\r75%\r100%${ESC}[K\nok${ESC}]0;title${BEL}${ESC}]52;c;AAAA${ESC}\\!`,
    `\u009b32mhi\u009d0;x\u009c${ESC}[?25l${ESC}(B\tz\b\bQ`,
  ]

  test('every chunk size gives the same result as one write', () => {
    for (const sample of samples) {
      const whole = parseAnsi(sample)
      for (const size of [1, 2, 3, 5, 7]) {
        expect(chunked(sample, size)).toEqual(whole)
      }
    }
  })

  test('a partial escape at the end of a chunk is not rendered, then completes', () => {
    const parser = createAnsiParser()
    parser.write(`ok ${ESC}[3`)
    expect(parser.openLine()!.segments.map((s) => s.text)).toEqual(['ok '])
    parser.write('1mred')
    expect(parser.openLine()!.segments.map((s) => [s.text, s.style.fg])).toEqual([
      ['ok ', undefined],
      ['red', 1],
    ])
  })

  test('a partial OSC at the end of a chunk stays hidden across chunks', () => {
    const parser = createAnsiParser()
    parser.write(`a${ESC}]52;c;QUJD`)
    expect(parser.openLine()!.segments.map((s) => s.text)).toEqual(['a'])
    parser.write(`REVG${BEL}b`)
    expect(parser.openLine()!.segments.map((s) => s.text)).toEqual(['ab'])
  })

  test('an ESC that ends a chunk and a backslash that begins the next form an ST', () => {
    const parser = createAnsiParser()
    parser.write(`a${ESC}]0;t${ESC}`)
    parser.write('\\b')
    expect(ansiLineText(parser.openLine()!)).toBe('ab')
  })

  test('finished lines are not touched by later writes', () => {
    const parser = createAnsiParser()
    parser.write('first\nsec')
    const [first] = parser.lines
    parser.write('ond\nthird')
    expect(parser.lines[0]).toBe(first)
    expect(parser.lines.map(ansiLineText)).toEqual(['first', 'second'])
    expect(ansiLineText(parser.openLine()!)).toBe('third')
  })

  test('a return at the end of one chunk applies to the first character of the next', () => {
    const parser = createAnsiParser()
    parser.write('old text\r')
    parser.write('new')
    expect(ansiLineText(parser.openLine()!)).toBe('new text')
  })

  test('a CRLF split across chunks is still a line break', () => {
    const parser = createAnsiParser()
    parser.write('line\r')
    parser.write('\nnext')
    expect(parser.lines.map(ansiLineText)).toEqual(['line'])
    expect(ansiLineText(parser.openLine()!)).toBe('next')
  })
})

describe('createAnsiParser: bounds', () => {
  test('a huge line is capped and the omission is counted', () => {
    const [line] = parseAnsi('x'.repeat(1_000_000), { maxLineLength: 1000 })
    expect(ansiLineText(line!).length).toBe(1000)
    expect(line!.truncated).toBe(999_000)
  })

  test('the cap holds across chunks and through overwrites', () => {
    const parser = createAnsiParser({ maxLineLength: 10 })
    for (let i = 0; i < 100; i += 1) parser.write('abcdef')
    expect(ansiLineText(parser.openLine()!).length).toBe(10)
    parser.write('\rZZZ')
    expect(ansiLineText(parser.openLine()!)).toBe('ZZZdefabcd')
  })

  test('a line that is only escape sequences is empty, not truncated', () => {
    const [line] = parseAnsi(`${ESC}[31m${ESC}[0m\n`)
    expect(line!.segments).toEqual([])
    expect(line!.truncated).toBe(0)
  })

  test('retainLines discards the oldest and counts them', () => {
    const parser = createAnsiParser({ retainLines: 100 })
    for (let i = 0; i < 1000; i += 1) parser.write(`line ${i}\n`)
    expect(parser.lines.length).toBeLessThan(100 + 200)
    expect(parser.lines.length).toBeGreaterThanOrEqual(100)
    expect(parser.droppedLines + parser.lines.length).toBe(1000)
    expect(ansiLineText(parser.lines.at(-1)!)).toBe('line 999')
  })

  test('100 000 lines parse in one pass', () => {
    const input = Array.from({ length: 100_000 }, (_, i) => `line ${i} ${ESC}[32mok${ESC}[0m`).join(
      '\n'
    )
    const lines = parseAnsi(input)
    expect(lines.length).toBe(100_000)
    expect(ansiLineText(lines[99_999]!)).toBe('line 99999 ok')
  })
})

describe('parseAnsi: arbitrary bytes', () => {
  const interesting = [
    ESC,
    '[',
    ']',
    '(',
    '\\',
    ';',
    ':',
    '?',
    '0',
    '1',
    '3',
    '8',
    '5',
    '2',
    'm',
    'K',
    'H',
    BEL,
    '\r',
    '\n',
    '\b',
    '\t',
    '\u009b',
    '\u009d',
    '\u009c',
    '\u0000',
    ' ',
    'a',
    '‮',
    '\ud83d',
    '\ude00',
  ]

  test('never throws and never leaks a control character', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const next = random(seed)
      let input = ''
      const length = 1 + Math.floor(next() * 400)
      for (let i = 0; i < length; i += 1) {
        input +=
          next() < 0.6
            ? interesting[Math.floor(next() * interesting.length)]
            : String.fromCharCode(Math.floor(next() * 0x10000))
      }

      const lines = parseAnsi(input, { maxLineLength: 64 })
      for (const line of lines) {
        const rendered = ansiLineText(line)
        // Only tab survives from the control range; no escape, no C1, no bidi.
        expect(hasForbiddenCharacter(rendered)).toBe(false)
        expect(rendered.length).toBeLessThanOrEqual(64)
        for (const segment of line.segments) {
          for (const color of [segment.style.fg, segment.style.bg]) {
            if (color !== undefined) {
              expect(color).toBeGreaterThanOrEqual(0)
              expect(color).toBeLessThanOrEqual(15)
            }
          }
        }
      }

      // The same input in uneven chunks gives the same result.
      const parser = createAnsiParser({ maxLineLength: 64 })
      let at = 0
      while (at < input.length) {
        const size = 1 + Math.floor(next() * 9)
        parser.write(input.slice(at, at + size))
        at += size
      }
      const open = parser.openLine()
      expect(open ? [...parser.lines, open] : [...parser.lines]).toEqual(lines)
    }
  })

  test('survives every single code unit', () => {
    for (let code = 0; code < 0x10000; code += 1) {
      expect(() => parseAnsi(`a${ESC}[${String.fromCharCode(code)}b`)).not.toThrow()
      expect(() => parseAnsi(`${ESC}]${String.fromCharCode(code)}`)).not.toThrow()
    }
  })
})
