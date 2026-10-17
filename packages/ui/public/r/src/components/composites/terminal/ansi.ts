/**
 * A terminal's text, read safely.
 *
 * Command output is untrusted bytes, not text: it carries colour for the human
 * who ran the command, cursor control for a screen that is not here, and — from
 * a hostile program — sequences that ask a terminal emulator to rewrite its
 * title, write to the clipboard (OSC 52) or hide what it printed. This parser
 * accepts exactly the part a transcript can honour and drops the rest:
 *
 * - **Kept:** printable text, `\n`, `\r` (the cursor returns to column 0 and
 *   later text overwrites, which is how a progress bar redraws itself), `\b`
 *   (the cursor steps back one column), tab, `ESC[…K` (erase in line, which
 *   progress bars pair with `\r`), and SGR `ESC[…m` for the sixteen theme
 *   colours, bold, dim, italic, underline, strike-through and reverse video.
 * - **Mapped:** 256-colour and truecolour SGR become the nearest of the sixteen,
 *   so the output keeps the theme's palette and its contrast guarantees instead
 *   of a program's idea of "dark blue" on a light terminal.
 * - **Dropped, never echoed:** every other CSI (cursor movement, scrolling,
 *   private modes), OSC, DCS/SOS/PM/APC strings, charset designations, the 8-bit
 *   C1 forms of all of these, every other control character, and the Unicode
 *   bidirectional overrides that make text read differently from how it is
 *   stored. A malformed or truncated sequence is dropped with its payload, so a
 *   half-received `ESC[3` never shows up as the text "3".
 *
 * Nothing here produces markup. The result is plain strings with a style object,
 * and the renderer decides what a style looks like.
 *
 * ## Why a stateful parser
 *
 * Output arrives in chunks that split anywhere — inside an escape sequence, in
 * the middle of a line. `createAnsiParser` keeps the half-read sequence, the
 * current style and the line being written between `write` calls, so a chunk
 * boundary changes nothing about the result. Finished lines are immutable and
 * never touched again, which is what lets a renderer keep their DOM while the
 * last line keeps growing. `parseAnsi` is the same thing run once.
 */

/** An index into the sixteen-colour palette: 0–7 normal, 8–15 bright. */
export type AnsiColor = number

export type AnsiStyle = Readonly<{
  fg?: AnsiColor
  bg?: AnsiColor
  bold?: true
  dim?: true
  italic?: true
  underline?: true
  strike?: true
  inverse?: true
}>

export type AnsiSegment = Readonly<{ text: string; style: AnsiStyle }>

export type AnsiLine = Readonly<{
  segments: readonly AnsiSegment[]
  /** Characters past `maxLineLength` that were not kept. Zero for most lines. */
  truncated: number
}>

export type AnsiParserOptions = {
  /** Characters kept per line; the rest are counted in `truncated`. Default 10 000. */
  maxLineLength?: number
  /**
   * Finished lines kept. The oldest are discarded (and counted in `droppedLines`)
   * past this, so a command that prints for an hour cannot grow the parser
   * without bound. Default 200 000.
   */
  retainLines?: number
}

export type AnsiParser = {
  /** Feed the next chunk. Chunks may split anywhere, including inside an escape. */
  write(chunk: string): void
  /** Finished lines, oldest first. The array is mutated in place as lines arrive. */
  readonly lines: readonly AnsiLine[]
  /** The line still being written, or `undefined` while it is empty. */
  openLine(): AnsiLine | undefined
  /** Finished lines discarded because of `retainLines`. */
  readonly droppedLines: number
}

export const ANSI_MAX_LINE_LENGTH = 10_000
export const ANSI_RETAIN_LINES = 200_000

/** Longest CSI parameter string worth reading; a real SGR is under 40 characters. */
const CSI_MAX = 256

const PLAIN: AnsiStyle = Object.freeze({})
const styleCache = new Map<string, AnsiStyle>()
const STYLE_CACHE_LIMIT = 4096

/**
 * Styles are shared by value so a long run of identical style compares by
 * reference when cells are merged into segments, and so a million coloured
 * characters do not allocate a million style objects.
 */
function intern(style: {
  fg?: AnsiColor
  bg?: AnsiColor
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  inverse?: boolean
}): AnsiStyle {
  const key = [
    style.fg ?? '',
    style.bg ?? '',
    style.bold ? 'b' : '',
    style.dim ? 'd' : '',
    style.italic ? 'i' : '',
    style.underline ? 'u' : '',
    style.strike ? 's' : '',
    style.inverse ? 'r' : '',
  ].join('|')
  if (key === '|||||||') return PLAIN
  const cached = styleCache.get(key)
  if (cached) return cached
  const next: AnsiStyle = Object.freeze({
    ...(style.fg !== undefined && { fg: style.fg }),
    ...(style.bg !== undefined && { bg: style.bg }),
    ...(style.bold && { bold: true as const }),
    ...(style.dim && { dim: true as const }),
    ...(style.italic && { italic: true as const }),
    ...(style.underline && { underline: true as const }),
    ...(style.strike && { strike: true as const }),
    ...(style.inverse && { inverse: true as const }),
  })
  if (styleCache.size < STYLE_CACHE_LIMIT) styleCache.set(key, next)
  return next
}

/** Whether a style paints nothing, so the renderer can emit a bare text node. */
export function isPlainStyle(style: AnsiStyle): boolean {
  return (
    style.fg === undefined &&
    style.bg === undefined &&
    !style.bold &&
    !style.dim &&
    !style.italic &&
    !style.underline &&
    !style.strike &&
    !style.inverse
  )
}

/**
 * The colours a style actually paints. Reverse video swaps them; a swapped side
 * with no colour of its own resolves to the terminal's default foreground or
 * background (`'default-fg'`, `'default-bg'`), which are themselves theme tokens.
 */
export type ResolvedColors = Readonly<{
  fg: AnsiColor | 'default-bg' | undefined
  bg: AnsiColor | 'default-fg' | undefined
}>

export function resolveColors(style: AnsiStyle): ResolvedColors {
  if (!style.inverse) return { fg: style.fg, bg: style.bg }
  return { fg: style.bg ?? 'default-bg', bg: style.fg ?? 'default-fg' }
}

// The xterm default palette, used only to decide which of the sixteen theme
// colours an extended colour is closest to.
const XTERM_16: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [205, 0, 0],
  [0, 205, 0],
  [205, 205, 0],
  [0, 0, 238],
  [205, 0, 205],
  [0, 205, 205],
  [229, 229, 229],
  [127, 127, 127],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [92, 92, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
]
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255] as const

const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value) || 0))

/** The palette index (0–15) nearest to an RGB colour. Channels are clamped to 0–255. */
export function nearestAnsiColor(r: number, g: number, b: number): AnsiColor {
  const red = clamp(r)
  const green = clamp(g)
  const blue = clamp(b)
  let best = 0
  let bestDistance = Infinity
  for (let index = 0; index < XTERM_16.length; index += 1) {
    const [pr, pg, pb] = XTERM_16[index]!
    // The weights are the "redmean" approximation: cheap, and much closer to how
    // the eye separates two colours than plain Euclidean distance.
    const meanRed = (red + pr) / 2
    const dr = red - pr
    const dg = green - pg
    const db = blue - pb
    const distance =
      (2 + meanRed / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanRed) / 256) * db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/** Map a 256-colour index to the sixteen. Out-of-range indices give `undefined`. */
export function ansi256ToColor(index: number): AnsiColor | undefined {
  if (!Number.isInteger(index) || index < 0 || index > 255) return undefined
  if (index < 16) return index
  if (index >= 232) {
    const grey = 8 + (index - 232) * 10
    return nearestAnsiColor(grey, grey, grey)
  }
  const cube = index - 16
  return nearestAnsiColor(
    CUBE_LEVELS[Math.floor(cube / 36)]!,
    CUBE_LEVELS[Math.floor(cube / 6) % 6]!,
    CUBE_LEVELS[cube % 6]!
  )
}

type MutableStyle = {
  fg?: AnsiColor
  bg?: AnsiColor
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  inverse?: boolean
}

/** A parameter is a short run of digits; anything else is not a number we trust. */
function toNumber(token: string | undefined): number | undefined {
  if (token === undefined) return undefined
  if (token === '') return 0
  if (token.length > 5 || !/^\d+$/.test(token)) return undefined
  return Number(token)
}

/**
 * Apply one SGR parameter list to a style. Unknown parameters are skipped one
 * at a time, so a program using a code we ignore still gets the colours around
 * it. Extended colours (38/48) consume their operands whether or not they are
 * valid, so a malformed one cannot be re-read as unrelated codes.
 */
function applySgr(current: AnsiStyle, params: string): AnsiStyle {
  const style: MutableStyle = { ...current }
  const tokens = params === '' ? ['0'] : params.split(';')

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!
    // The colon form `38:2::r:g:b` carries its operands in one token.
    if (token.includes(':')) {
      const parts = token.split(':')
      const head = toNumber(parts[0])
      if (head === 38 || head === 48) {
        const color = extendedColor(parts[1] === undefined ? [] : parts.slice(1), true)
        if (color !== null) assign(style, head, color)
      } else if (head === 4) {
        if (parts[1] === '0') style.underline = false
        else style.underline = true
      }
      continue
    }

    const code = toNumber(token)
    if (code === undefined) continue

    if (code === 38 || code === 48) {
      const mode = toNumber(tokens[i + 1])
      const count = mode === 5 ? 1 : mode === 2 ? 3 : 0
      const operands = tokens.slice(i + 2, i + 2 + count)
      i += 1 + count
      const color = extendedColor([String(mode ?? ''), ...operands], false)
      if (color !== null) assign(style, code, color)
      continue
    }
    if (code === 58) {
      // Underline colour: consumed so its operands are not read as codes, then ignored.
      const mode = toNumber(tokens[i + 1])
      i += 1 + (mode === 5 ? 1 : mode === 2 ? 3 : 0)
      continue
    }

    if (code === 0) {
      delete style.fg
      delete style.bg
      style.bold = style.dim = style.italic = style.underline = false
      style.strike = style.inverse = false
    } else if (code === 1) style.bold = true
    else if (code === 2) style.dim = true
    else if (code === 3) style.italic = true
    else if (code === 4 || code === 21) style.underline = true
    else if (code === 7) style.inverse = true
    else if (code === 9) style.strike = true
    else if (code === 22) style.bold = style.dim = false
    else if (code === 23) style.italic = false
    else if (code === 24) style.underline = false
    else if (code === 27) style.inverse = false
    else if (code === 29) style.strike = false
    else if (code >= 30 && code <= 37) style.fg = code - 30
    else if (code === 39) delete style.fg
    else if (code >= 40 && code <= 47) style.bg = code - 40
    else if (code === 49) delete style.bg
    else if (code >= 90 && code <= 97) style.fg = code - 90 + 8
    else if (code >= 100 && code <= 107) style.bg = code - 100 + 8
    // Blink (5, 6), conceal (8), overline (53) and the rest are ignored. Conceal
    // in particular is not honoured: output must not be able to hide itself.
  }
  return intern(style)
}

/** The colour an extended-colour operand list names, or `null` when it is invalid. */
function extendedColor(parts: readonly string[], colon: boolean): AnsiColor | null {
  const mode = toNumber(parts[0])
  if (mode === 5) {
    const index = toNumber(parts[1])
    const color = index === undefined ? undefined : ansi256ToColor(index)
    return color ?? null
  }
  if (mode === 2) {
    // In the colon form a colour-space id may precede the channels, empty or not.
    const channels = colon && parts.length > 4 ? parts.slice(2) : parts.slice(1)
    const [r, g, b] = channels.slice(0, 3).map(toNumber)
    if (r === undefined || g === undefined || b === undefined) return null
    if (r > 255 || g > 255 || b > 255) return null
    return nearestAnsiColor(r, g, b)
  }
  return null
}

function assign(style: MutableStyle, code: number, color: AnsiColor): void {
  if (code === 38) style.fg = color
  else style.bg = color
}

/** Characters that are never rendered: C0 except tab, DEL, C1, and bidi controls. */
function isDroppedControl(code: number): boolean {
  return (
    (code < 0x20 && code !== 0x09) ||
    code === 0x7f ||
    (code >= 0x80 && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0x2028 ||
    code === 0x2029
  )
}

type Run = { text: string; style: AnsiStyle }

/**
 * The line being written. While the cursor only ever moves right it is a list of
 * styled runs, which is cheap; the first time something moves it left (`\r`,
 * `\b`) it becomes one cell per UTF-16 unit so later text can overwrite.
 */
class LineBuffer {
  private runs: Run[] = []
  private cells: string[] | undefined
  private cellStyles: AnsiStyle[] | undefined
  private cursor = 0
  private length = 0
  private dropped = 0
  /** A `\r` seen but not yet applied: `\r\n` is by far the common case. */
  private pendingReturn = false

  constructor(private readonly max: number) {}

  isEmpty(): boolean {
    return this.length === 0 && this.dropped === 0
  }

  put(text: string, style: AnsiStyle): void {
    if (text === '') return
    this.applyReturn()
    if (this.cells === undefined) {
      const room = this.max - this.length
      if (room <= 0) {
        this.dropped += text.length
        return
      }
      const kept = text.length > room ? text.slice(0, room) : text
      this.dropped += text.length - kept.length
      const last = this.runs[this.runs.length - 1]
      if (last && last.style === style) last.text += kept
      else this.runs.push({ text: kept, style })
      this.length += kept.length
      this.cursor = this.length
      return
    }
    for (let i = 0; i < text.length; i += 1) this.putCell(text[i]!, style)
  }

  private putCell(char: string, style: AnsiStyle): void {
    const cells = this.cells!
    const styles = this.cellStyles!
    if (this.cursor >= this.max) {
      this.dropped += 1
      return
    }
    while (cells.length < this.cursor) {
      cells.push(' ')
      styles.push(PLAIN)
    }
    cells[this.cursor] = char
    styles[this.cursor] = style
    this.cursor += 1
    this.length = cells.length
  }

  carriageReturn(): void {
    this.pendingReturn = true
  }

  backspace(): void {
    this.applyReturn()
    if (this.cursor === 0) return
    this.toCells()
    this.cursor -= 1
  }

  /** `ESC[nK`: 0 from the cursor to the end, 1 start to cursor, 2 the whole line. */
  eraseInLine(mode: number): void {
    this.applyReturn()
    if (mode === 0 && this.cursor >= this.length) return
    this.toCells()
    const cells = this.cells!
    const styles = this.cellStyles!
    if (mode === 0) {
      cells.length = this.cursor
      styles.length = this.cursor
    } else if (mode === 1) {
      for (let i = 0; i <= this.cursor && i < cells.length; i += 1) {
        cells[i] = ' '
        styles[i] = PLAIN
      }
    } else if (mode === 2) {
      cells.length = 0
      styles.length = 0
    }
    this.length = cells.length
  }

  private applyReturn(): void {
    if (!this.pendingReturn) return
    this.pendingReturn = false
    if (this.length === 0) {
      this.cursor = 0
      return
    }
    this.toCells()
    this.cursor = 0
  }

  private toCells(): void {
    if (this.cells !== undefined) return
    const cells: string[] = []
    const styles: AnsiStyle[] = []
    for (const run of this.runs) {
      for (let i = 0; i < run.text.length; i += 1) {
        cells.push(run.text[i]!)
        styles.push(run.style)
      }
    }
    this.cells = cells
    this.cellStyles = styles
    this.runs = []
    this.cursor = Math.min(this.cursor, cells.length)
  }

  snapshot(): AnsiLine {
    const segments: AnsiSegment[] = []
    if (this.cells === undefined) {
      for (const run of this.runs) segments.push({ text: run.text, style: run.style })
    } else {
      const cells = this.cells
      const styles = this.cellStyles!
      let start = 0
      for (let i = 1; i <= cells.length; i += 1) {
        if (i === cells.length || styles[i] !== styles[start]) {
          segments.push({ text: cells.slice(start, i).join(''), style: styles[start]! })
          start = i
        }
      }
    }
    return { segments, truncated: this.dropped }
  }

  reset(): void {
    this.runs = []
    this.cells = undefined
    this.cellStyles = undefined
    this.cursor = 0
    this.length = 0
    this.dropped = 0
    this.pendingReturn = false
  }
}

type State = 'text' | 'esc' | 'esc-intermediate' | 'csi' | 'string' | 'string-esc'

export function createAnsiParser(options: AnsiParserOptions = {}): AnsiParser {
  const maxLine = Math.max(1, Math.floor(options.maxLineLength ?? ANSI_MAX_LINE_LENGTH))
  const retain = Math.max(1, Math.floor(options.retainLines ?? ANSI_RETAIN_LINES))
  const lines: AnsiLine[] = []
  let droppedLines = 0
  const line = new LineBuffer(maxLine)
  let style: AnsiStyle = PLAIN
  let state: State = 'text'
  let csi = ''
  let csiOverflow = false
  // Only the 7-bit `ESC [` introducer is honoured. The 8-bit form is consumed so
  // its parameters are not echoed, but it never changes the style: it is a rarity
  // in real output and a favourite of filter-evasion payloads.
  let csiHonoured = true

  const finishLine = () => {
    lines.push(line.snapshot())
    line.reset()
    // Trim in blocks so the common append stays O(1) amortised.
    if (lines.length > retain + Math.max(64, retain >> 3)) {
      const excess = lines.length - retain
      lines.splice(0, excess)
      droppedLines += excess
    }
  }

  const runCsi = (final: string) => {
    if (csiOverflow || !csiHonoured) return
    // Only plain numeric parameters are honoured; a private marker (`?`, `>`,
    // `<`, `=`) or an intermediate byte makes this some other command entirely.
    if (!/^[\d;:]*$/.test(csi)) return
    if (final === 'm') style = applySgr(style, csi)
    else if (final === 'K') {
      const mode = toNumber(csi.split(';')[0])
      if (mode !== undefined && mode <= 2) line.eraseInLine(mode)
    }
  }

  function write(chunk: string): void {
    for (let i = 0; i < chunk.length; i += 1) {
      const code = chunk.charCodeAt(i)

      switch (state) {
        case 'text': {
          if (!isDroppedControl(code)) {
            // Take the whole run of ordinary characters at once.
            let end = i + 1
            while (end < chunk.length && !isDroppedControl(chunk.charCodeAt(end))) end += 1
            line.put(chunk.slice(i, end), style)
            i = end - 1
            break
          }
          if (code === 0x1b) state = 'esc'
          else if (code === 0x0a) finishLine()
          else if (code === 0x0d) line.carriageReturn()
          else if (code === 0x08) line.backspace()
          else if (code === 0x9b) {
            state = 'csi'
            csi = ''
            csiOverflow = false
            csiHonoured = false
          } else if (
            code === 0x9d ||
            code === 0x90 ||
            code === 0x98 ||
            code === 0x9e ||
            code === 0x9f
          ) {
            state = 'string'
          }
          // Every other control character is dropped.
          break
        }
        case 'esc': {
          if (code === 0x5b) {
            state = 'csi'
            csi = ''
            csiOverflow = false
            csiHonoured = true
          } else if (
            code === 0x5d ||
            code === 0x50 ||
            code === 0x58 ||
            code === 0x5e ||
            code === 0x5f
          ) {
            state = 'string'
          } else if (code >= 0x20 && code <= 0x2f) state = 'esc-intermediate'
          else if (code >= 0x30 && code <= 0x7e) state = 'text'
          else if (code === 0x1b) state = 'esc'
          else {
            state = 'text'
            i -= 1
          }
          break
        }
        case 'esc-intermediate': {
          if (code >= 0x20 && code <= 0x2f) break
          if (code >= 0x30 && code <= 0x7e) state = 'text'
          else {
            state = 'text'
            i -= 1
          }
          break
        }
        case 'csi': {
          if (code >= 0x20 && code <= 0x3f) {
            if (csi.length < CSI_MAX) csi += chunk[i]
            else csiOverflow = true
          } else if (code >= 0x40 && code <= 0x7e) {
            runCsi(chunk[i]!)
            state = 'text'
          } else if (code === 0x1b) state = 'esc'
          else {
            // A control character or non-ASCII byte cannot be part of a CSI: the
            // sequence was malformed. Drop it and read this character normally.
            state = 'text'
            i -= 1
          }
          break
        }
        case 'string': {
          if (code === 0x07 || code === 0x9c) state = 'text'
          else if (code === 0x1b) state = 'string-esc'
          else if (code === 0x0a || code === 0x0d) {
            // No real title or clipboard payload spans a line. Ending here bounds
            // what an unterminated string can swallow to the rest of its line.
            state = 'text'
            i -= 1
          }
          break
        }
        case 'string-esc': {
          if (code === 0x5c) state = 'text'
          else {
            state = 'esc'
            i -= 1
          }
          break
        }
      }
    }
  }

  return {
    write,
    lines,
    openLine: () => (line.isEmpty() ? undefined : line.snapshot()),
    get droppedLines() {
      return droppedLines
    },
  }
}

/** Parse a whole output at once: finished lines plus the open one, if any. */
export function parseAnsi(text: string, options?: AnsiParserOptions): AnsiLine[] {
  const parser = createAnsiParser(options)
  parser.write(text)
  const open = parser.openLine()
  return open ? [...parser.lines, open] : [...parser.lines]
}

/** A line's text with styling removed, for tests and for accessible names. */
export function ansiLineText(line: AnsiLine): string {
  return line.segments.map((segment) => segment.text).join('')
}
