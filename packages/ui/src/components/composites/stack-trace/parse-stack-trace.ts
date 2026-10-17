/**
 * Stack traces, read without being trusted or trimmed.
 *
 * A trace is text a runtime wrote about itself, and every language writes it
 * differently. This parses the three a coding agent meets most — V8/Node
 * (`at fn (file:line:col)`), Python (`File "x", line N, in fn`) and Rust panic
 * backtraces (`  0: symbol` then `at file:line:col`) — into frames, and does
 * three things a formatter would not:
 *
 * - **It never hides a line.** Every input line ends up in `entries`, as a frame
 *   or as text, in order. A line the parser does not recognise is text, and a
 *   trace it recognises nothing in has `format: 'unknown'` and `frames: []`, so a
 *   caller falls back to showing the raw string. The header (error type and
 *   message) is lifted out of the entries only when it is unambiguous.
 * - **It makes no claim about whose code a frame is without evidence.** A frame
 *   is a dependency when its path says so (`node_modules`, `site-packages`,
 *   `.cargo/registry`), internal when it belongs to the runtime (`node:` URLs,
 *   Python's frozen modules, Rust's `std`), and first-party otherwise. A host that
 *   knows better passes `classify`.
 * - **It is bounded.** Lines over 4 000 characters are never run through a
 *   pattern, and input past 10 000 lines is kept as one trailing text entry. Every
 *   pattern is anchored and linear, so a hostile trace cannot make parsing slow.
 *
 * Parsing is line-oriented and each line is classified on its own, so a trace
 * that mixes formats (a Node process that shells out to Python) keeps both.
 */

export type StackFrameKind = 'first-party' | 'dependency' | 'internal'
export type StackTraceFormat = 'v8' | 'python' | 'rust' | 'unknown'

export type StackFrame = Readonly<{
  /** The line exactly as written, minus its line ending. */
  raw: string
  function?: string
  /** The path or URL as written. Undefined for `<anonymous>`, `native` and the like. */
  file?: string
  line?: number
  column?: number
  kind: StackFrameKind
  async?: true
  /** Lines the runtime printed beneath the frame, such as Python's source line. */
  detail?: readonly string[]
}>

export type StackEntry =
  | Readonly<{ type: 'frame'; frame: StackFrame }>
  | Readonly<{ type: 'text'; text: string }>

export type StackTraceHeader = Readonly<{
  /** `TypeError`, `ValueError`, `thread 'main' panicked`. */
  type?: string
  message: string
  /** Where a Rust panic says it happened. */
  location?: string
}>

export type ParsedStackTrace = Readonly<{
  format: StackTraceFormat
  header?: StackTraceHeader
  /** Everything that is not the header, in order. */
  entries: readonly StackEntry[]
  frames: readonly StackFrame[]
}>

export type ParseStackTraceOptions = {
  /** Override the built-in first-party/dependency/internal guess for a frame. */
  classify?: (frame: StackFrame) => StackFrameKind | undefined
}

export const STACK_MAX_LINES = 10_000
const LINE_PATTERN_LIMIT = 4000

type Draft = {
  raw: string
  function?: string
  file?: string
  line?: number
  column?: number
  async?: true
  detail?: string[]
  format: 'v8' | 'python' | 'rust'
}

function trailingNumber(value: string): { value: number; rest: string } | undefined {
  let i = value.length
  while (i > 0 && value.charCodeAt(i - 1) >= 48 && value.charCodeAt(i - 1) <= 57) i -= 1
  if (i === value.length || i === 0 || value[i - 1] !== ':' || value.length - i > 9)
    return undefined
  return { value: Number(value.slice(i)), rest: value.slice(0, i - 1) }
}

/** Split `path:line:col` from the right, so a Windows drive or a URL port stays in the path. */
export function splitLocation(location: string): { file: string; line?: number; column?: number } {
  const last = trailingNumber(location)
  if (!last || last.rest === '') return { file: location }
  const before = trailingNumber(last.rest)
  if (before && before.rest !== '') {
    return { file: before.rest, line: before.value, column: last.value }
  }
  return { file: last.rest, line: last.value }
}

/**
 * Split the pre-1.78 Rust panic suffix `'message', location`. The message may
 * contain `', ` itself, and the greedy pattern this replaces took the last
 * occurrence with a non-space behind it — this scan keeps that last-wins
 * answer, in one pass, so a message repeating the marker stays linear.
 */
function splitRustOldPanic(after: string): { message: string; location: string } | undefined {
  // As in `parsePython`: no `.` in the old pattern could cross a line break.
  if (/[\n\r\u2028\u2029]/.test(after) || !after.startsWith("'")) return undefined
  let close: number | undefined
  let search = 1
  for (;;) {
    const at = after.indexOf("', ", search)
    if (at < 0) break
    search = at + 1
    const start = at + 3
    if (start >= after.length) continue
    // Preserve ECMAScript \S, including NBSP/BOM and Unicode space separators.
    if (/\s/.test(after[start]!)) continue
    close = at
  }
  if (close === undefined) return undefined
  return { message: after.slice(1, close), location: after.slice(close + 3) }
}

const FILE_LIKE = /[\\/]|\.[A-Za-z0-9]{1,6}$/
const URL_LIKE = /^node:/i

/** Whether a V8 location is a place in a file rather than a runtime annotation. */
function v8Location(location: string): Partial<Draft> | undefined {
  if (location === '<anonymous>' || location === 'native' || /^index \d+$/.test(location)) {
    return {}
  }
  if (location.startsWith('eval at ')) return {}
  const split = splitLocation(location)
  if (split.line !== undefined || FILE_LIKE.test(split.file) || URL_LIKE.test(split.file)) {
    return { file: split.file, line: split.line, column: split.column }
  }
  return undefined
}

function parseV8(trimmed: string): Draft | undefined {
  if (!trimmed.startsWith('at ')) return undefined
  const rest = trimmed.slice(3)
  if (rest === '') return undefined

  let fn: string | undefined
  let location: string
  if (rest.endsWith(')') && rest.includes(' (')) {
    const open = rest.indexOf(' (')
    fn = rest.slice(0, open)
    location = rest.slice(open + 2, -1)
  } else {
    location = rest
  }
  const parsed = v8Location(location)
  if (!parsed) return undefined
  // Without parentheses the whole remainder was the location, and it must carry
  // a line or a path — otherwise "at the end of the day" would be a frame.
  if (
    fn === undefined &&
    parsed.file === undefined &&
    location !== '<anonymous>' &&
    location !== 'native'
  ) {
    return undefined
  }

  const draft: Draft = { raw: trimmed, format: 'v8', ...parsed }
  if (fn !== undefined) {
    if (fn.startsWith('async ')) {
      draft.async = true
      fn = fn.slice(6)
    }
    if (fn !== '') draft.function = fn
  }
  return draft
}

const PYTHON_PREFIX = 'File "'
const PYTHON_LINE = '", line '
const PYTHON_IN = ', in '

/** Whether a character is an ASCII digit, as `\d` was in the pattern this replaced. */
function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

/**
 * Read a Python frame: `File "<file>", line <n>[, in <fn>]`.
 *
 * Scanned, not matched. A line repeating the frame shape many times must still
 * cost one pass, so the closing `", line ` is found by walking its candidates
 * left to right. The last valid candidate wins — what the greedy pattern this
 * replaces would have settled on — so a file path containing a quote still
 * parses exactly as it always did.
 */
function parsePython(trimmed: string): Draft | undefined {
  // `.` never matches a line break, so the whole-line pattern this replaces
  // could not have matched a string containing one either.
  if (/[\n\r\u2028\u2029]/.test(trimmed) || !trimmed.startsWith(PYTHON_PREFIX)) return undefined
  let close: number | undefined
  let digits = 0
  let rest = 0
  let hasIn = false
  let search = PYTHON_PREFIX.length
  for (;;) {
    const at = trimmed.indexOf(PYTHON_LINE, search)
    if (at < 0) break
    search = at + 1
    let end = at + PYTHON_LINE.length
    const start = end
    while (end < trimmed.length && isDigit(trimmed.charCodeAt(end))) end += 1
    if (end === start) continue
    if (end < trimmed.length && !trimmed.startsWith(PYTHON_IN, end)) continue
    close = at
    digits = end - start
    rest = end
    hasIn = end < trimmed.length
  }
  if (close === undefined) return undefined
  const draft: Draft = {
    raw: trimmed,
    format: 'python',
    file: trimmed.slice(PYTHON_PREFIX.length, close),
    line: Number(trimmed.slice(rest - digits, rest)),
  }
  if (hasIn) {
    const fn = trimmed.slice(rest + PYTHON_IN.length)
    if (fn) draft.function = fn
  }
  return draft
}

const RUST_FRAME = /^(\d+):\s+(?:0x[0-9a-fA-F]+ - )?(\S.*)$/
const RUST_LOCATION = /^at\s+(\S.*)$/

function parseRustFrame(trimmed: string, rustContext: boolean): Draft | undefined {
  const match = RUST_FRAME.exec(trimmed)
  if (!match) return undefined
  const symbol = match[2]!
  if (!rustContext && !symbol.includes('::')) return undefined
  return { raw: trimmed, format: 'rust', function: symbol }
}

const INTERNAL_RUST_SYMBOLS =
  /^(?:std|core|alloc)::|^<?(?:\w+ as )?(?:std|core|alloc)::|^(?:rust_begin_unwind|rust_panic|__rust_|_start$|__libc_|_main$)/

/** The built-in guess at whose code a frame is. See the module comment. */
export function classifyFrame(
  frame: Omit<StackFrame, 'kind'>,
  format: StackTraceFormat
): StackFrameKind {
  const file = frame.file?.replaceAll('\\', '/')
  if (format === 'rust') {
    if (file !== undefined) {
      if (file.startsWith('/rustc/') || /\/library\/(?:std|core|alloc)\//.test(file))
        return 'internal'
      if (/\/\.cargo\/(?:registry|git)\/|\/registry\/src\//.test(file)) return 'dependency'
      return 'first-party'
    }
    return frame.function !== undefined && INTERNAL_RUST_SYMBOLS.test(frame.function)
      ? 'internal'
      : 'first-party'
  }
  if (file === undefined) return 'internal'
  if (format === 'python') {
    if (/\/(?:site|dist)-packages\//.test(file)) return 'dependency'
    if (
      file.startsWith('<') ||
      /\/lib\/python\d/i.test(file) ||
      /\/python\d[\d.]*\/lib\//i.test(file)
    ) {
      return 'internal'
    }
    return 'first-party'
  }
  if (file.startsWith('node:') || file.startsWith('internal/') || file.startsWith('wasm://')) {
    return 'internal'
  }
  if (file.includes('/node_modules/') || file.startsWith('node_modules/')) return 'dependency'
  return 'first-party'
}

function finishFrame(draft: Draft, options: ParseStackTraceOptions | undefined): StackFrame {
  const { format, detail, ...base } = draft
  const shape: Omit<StackFrame, 'kind'> = detail && detail.length > 0 ? { ...base, detail } : base
  // Classified by the frame's own format, so a mixed trace keeps both languages' rules.
  const guess = classifyFrame(shape, format)
  const override = options?.classify?.({ ...shape, kind: guess })
  return { ...shape, kind: override ?? guess }
}

const TYPE_AND_MESSAGE = /^([A-Za-z_$][\w$.]*)(?::\s?([\s\S]*))?$/

function splitTypeAndMessage(lines: readonly string[]): StackTraceHeader {
  const first = lines[0] ?? ''
  const match = TYPE_AND_MESSAGE.exec(first)
  const tail = lines.slice(1)
  if (!match) return { message: lines.join('\n') }
  const message = [match[2] ?? '', ...tail].join('\n').replace(/^\n+/, '')
  return { type: match[1], message }
}

/** Parse a stack trace. Never throws, and every input line appears in the result. */
export function parseStackTrace(text: string, options?: ParseStackTraceOptions): ParsedStackTrace {
  const rawLines = text.split('\n')
  const overflow = rawLines.length > STACK_MAX_LINES ? rawLines.splice(STACK_MAX_LINES) : []
  const rustContext = /panicked at|stack backtrace|RUST_BACKTRACE/.test(text.slice(0, 200_000))

  type Item = { type: 'text'; text: string } | { type: 'frame'; draft: Draft }
  const items: Item[] = []
  let python: Draft | undefined
  let rust: Draft | undefined

  for (const original of rawLines) {
    const line = original.endsWith('\r') ? original.slice(0, -1) : original
    const trimmed = line.trim()

    if (line.length > LINE_PATTERN_LIMIT || trimmed === '') {
      python = rust = undefined
      items.push({ type: 'text', text: line })
      continue
    }

    // Python prints the offending source line, indented, under its frame.
    if (python && /^\s/.test(line) && !trimmed.startsWith('File "')) {
      ;(python.detail ??= []).push(line)
      continue
    }

    if (rust && rust.file === undefined && RUST_LOCATION.test(trimmed)) {
      const split = splitLocation(RUST_LOCATION.exec(trimmed)![1]!)
      rust.file = split.file
      rust.line = split.line
      rust.column = split.column
      rust.raw = `${rust.raw}\n${line}`
      continue
    }

    const draft = parsePython(trimmed) ?? parseRustFrame(trimmed, rustContext) ?? parseV8(trimmed)
    python = draft?.format === 'python' ? draft : undefined
    rust = draft?.format === 'rust' ? draft : undefined
    if (draft) items.push({ type: 'frame', draft })
    else items.push({ type: 'text', text: line })
  }
  if (overflow.length > 0) items.push({ type: 'text', text: overflow.join('\n') })

  const counts = { v8: 0, python: 0, rust: 0 }
  for (const item of items) if (item.type === 'frame') counts[item.draft.format] += 1
  const total = counts.v8 + counts.python + counts.rust
  const format: StackTraceFormat =
    total === 0
      ? 'unknown'
      : counts.python >= counts.v8 && counts.python >= counts.rust
        ? 'python'
        : counts.rust >= counts.v8
          ? 'rust'
          : 'v8'

  const entries: StackEntry[] = items.map((item) =>
    item.type === 'text' ? item : { type: 'frame', frame: finishFrame(item.draft, options) }
  )

  if (format === 'unknown') return { format, entries, frames: [] }

  const header = liftHeader(entries, format)
  const frames = entries.flatMap((entry) => (entry.type === 'frame' ? [entry.frame] : []))
  return { format, ...(header && { header }), entries, frames }
}

/**
 * Take the header out of the entries it came from. V8 and Rust print it before
 * the frames; Python prints it after. The lifted lines are removed so they are
 * drawn once, as the header, and nothing else is touched.
 */
function liftHeader(entries: StackEntry[], format: StackTraceFormat): StackTraceHeader | undefined {
  const firstFrame = entries.findIndex((entry) => entry.type === 'frame')

  if (format === 'python') {
    let last = entries.length - 1
    while (last >= 0 && (entries[last]!.type !== 'text' || isBlank(entries[last]!))) last -= 1
    let lastFrame = entries.length - 1
    while (lastFrame >= 0 && entries[lastFrame]!.type !== 'frame') lastFrame -= 1
    const entry = entries[last]
    // Only a line shaped like `Type: message` is taken as the header; anything
    // else after the last frame (`[Previous line repeated …]`) stays where it is.
    if (
      !entry ||
      entry.type !== 'text' ||
      last < lastFrame ||
      /^\s/.test(entry.text) ||
      !TYPE_AND_MESSAGE.test(entry.text.trim())
    ) {
      return undefined
    }
    entries.splice(last, 1)
    return splitTypeAndMessage([entry.text.trim()])
  }

  if (format === 'rust') {
    const panicAt = entries.findIndex(
      (entry, index) =>
        index < firstFrame && entry.type === 'text' && /panicked at/.test(entry.text)
    )
    if (panicAt < 0) return undefined
    const first = (entries[panicAt] as { text: string }).text.trim()
    const at = first.indexOf(' at ')
    if (at < 0) return undefined
    const type = first.slice(0, at).trim()
    const after = first.slice(at + 4)
    const old = splitRustOldPanic(after)
    let consumed = 1
    let message: string
    let location: string | undefined
    if (old) {
      message = old.message
      location = old.location
    } else {
      location = after.replace(/:$/, '')
      const body: string[] = []
      for (let i = panicAt + 1; i < firstFrame; i += 1) {
        const entry = entries[i]!
        if (
          entry.type !== 'text' ||
          isBlank(entry) ||
          /^(?:note:|stack backtrace:)/.test(entry.text.trim())
        )
          break
        body.push(entry.text)
        consumed += 1
      }
      message = body.join('\n')
    }
    entries.splice(panicAt, consumed)
    return { type, message, ...(location && { location }) }
  }

  // V8: the block of non-blank lines directly above the first frame. Anything
  // above a blank line — Node prints the source line that threw — stays as text.
  if (firstFrame <= 0) return undefined
  let start = firstFrame
  while (start > 0 && entries[start - 1]!.type === 'text' && !isBlank(entries[start - 1]!))
    start -= 1
  if (start === firstFrame) return undefined
  const lines = entries.slice(start, firstFrame).map((entry) => (entry as { text: string }).text)
  entries.splice(start, firstFrame - start)
  return splitTypeAndMessage(lines)
}

function isBlank(entry: StackEntry): boolean {
  return entry.type === 'text' && entry.text.trim() === ''
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export type StackBlock =
  | Readonly<{ type: 'frame'; frame: StackFrame }>
  | Readonly<{ type: 'text'; text: string }>
  | Readonly<{ type: 'group'; frames: readonly StackFrame[] }>

/**
 * Fold runs of dependency and runtime frames into groups, so a trace reads as
 * the code the reader owns with the framework's frames one click away.
 *
 * A run of one stays a frame — a disclosure around a single line costs more than
 * it saves. When there is no first-party frame at all nothing is grouped:
 * collapsing everything would hide the entire trace behind a button, which is the
 * opposite of what a reader who owns none of the frames needs.
 */
export function groupStackEntries(
  entries: readonly StackEntry[],
  collapse = true
): readonly StackBlock[] {
  const hasFirstParty = entries.some(
    (entry) => entry.type === 'frame' && entry.frame.kind === 'first-party'
  )
  if (!collapse || !hasFirstParty) return entries

  const blocks: StackBlock[] = []
  let run: StackFrame[] = []
  const flush = () => {
    if (run.length >= 2) blocks.push({ type: 'group', frames: run })
    else for (const frame of run) blocks.push({ type: 'frame', frame })
    run = []
  }
  for (const entry of entries) {
    if (entry.type === 'frame' && entry.frame.kind !== 'first-party') {
      run.push(entry.frame)
      continue
    }
    flush()
    blocks.push(entry)
  }
  flush()
  return blocks
}

const framesNoun = (count: number, word: string) =>
  `${count.toLocaleString()} ${word} ${count === 1 ? 'frame' : 'frames'}`

/** What a collapsed group says it holds. */
export function describeFrameGroup(frames: readonly StackFrame[]): string {
  const count = frames.length
  const dependency = frames.filter((frame) => frame.kind === 'dependency').length
  if (dependency === count) return framesNoun(count, 'dependency')
  if (dependency === 0) return framesNoun(count, 'runtime')
  return `${count.toLocaleString()} dependency and runtime frames`
}

/** `file:line:col`, with whichever parts the frame has. */
export function frameLocation(frame: StackFrame): string | undefined {
  if (frame.file === undefined) return undefined
  const column = frame.column === undefined ? '' : `:${frame.column}`
  const line = frame.line === undefined ? '' : `:${frame.line}`
  return `${frame.file}${line}${line ? column : ''}`
}

const LEADING_SPACE = /^[ \t]*/

/** Remove the indentation every non-blank line shares, so a source snippet sits flush. */
export function dedentLines(lines: readonly string[]): string[] {
  let indent = Infinity
  for (const line of lines) {
    if (line.trim() !== '') indent = Math.min(indent, LEADING_SPACE.exec(line)![0].length)
  }
  if (indent === Infinity) return [...lines]
  return lines.map((line) => line.slice(Math.min(indent, LEADING_SPACE.exec(line)![0].length)))
}

export type BoundedLines = Readonly<{
  lines: string[]
  /** Lines beyond the bound that are not in `lines` at all. */
  omittedLines: number
  /** Characters beyond the bound, in omitted lines and in the cut end of the last shown line. */
  omittedChars: number
}>

/**
 * The first lines of `lines`, up to `maxLines` of them and `maxChars` characters
 * between them, with what was left out counted rather than dropped silently. It
 * visits the shown lines and adds up the length of the rest, so the cost does not
 * depend on how much text there is to omit.
 */
export function boundLines(
  lines: readonly string[],
  maxLines: number,
  maxChars: number
): BoundedLines {
  const shown: string[] = []
  let chars = 0
  let index = 0
  let partial = 0
  while (index < lines.length && shown.length < maxLines) {
    const line = lines[index]!
    const room = maxChars - chars
    if (line.length <= room) {
      shown.push(line)
      chars += line.length
      index += 1
      continue
    }
    if (room > 0) {
      shown.push(line.slice(0, room))
      partial = line.length - room
      index += 1
    }
    break
  }
  let omittedChars = partial
  for (let rest = index; rest < lines.length; rest += 1) omittedChars += lines[rest]!.length
  return { lines: shown, omittedLines: lines.length - index, omittedChars }
}
