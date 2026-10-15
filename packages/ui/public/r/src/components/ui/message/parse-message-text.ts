/**
 * A small, safe reading of model and user text.
 *
 * Assistant output is untrusted: it can contain anything a model, a tool result
 * or a pasted web page put there. This parser therefore produces *data* —
 * blocks and inline spans — and the renderer turns that data into text nodes and
 * a fixed set of elements. There is no HTML pass, no `innerHTML`, and no
 * attribute built from the text other than a link `href` that has passed
 * `safeHref`.
 *
 * It reads a deliberately small subset of Markdown: fenced code, headings,
 * flat lists, block quotes, paragraphs, and inline code, bold, italic and links.
 * Anything it does not recognise stays as paragraph text with its line breaks
 * (the paragraph renders `white-space: pre-wrap`), so unsupported syntax
 * degrades to readable source instead of vanishing.
 *
 * A citation marker, `[^1]` or `[^1,2]`, is read only when the caller says how
 * many sources it has (`citations`) and every number names one of them. A marker
 * the host cannot resolve stays literal text: it is never a citation by shape
 * alone, and `arr[1]` or a footnote the model invented is not one either.
 *
 * Streaming is a first-class input. `streaming: true` means the text may end
 * mid-construct, so an unterminated fence is a *partial* code block — shown as
 * code from its first line, flagged incomplete — and an unterminated inline
 * span stays literal until its closing delimiter arrives. Once streaming stops,
 * an unterminated fence is just a code block that ends at the end of the text.
 */

export type MessageInline =
  | Readonly<{ kind: 'text'; text: string }>
  | Readonly<{ kind: 'code'; text: string }>
  | Readonly<{ kind: 'strong'; children: readonly MessageInline[] }>
  | Readonly<{ kind: 'em'; children: readonly MessageInline[] }>
  | Readonly<{ kind: 'link'; href: string; children: readonly MessageInline[] }>
  /** A resolved citation marker: 1-based source numbers, each within `citations`. */
  | Readonly<{ kind: 'cite'; numbers: readonly number[]; raw: string }>

export type MessageBlock =
  | Readonly<{ kind: 'paragraph'; inline: readonly MessageInline[]; raw: string }>
  | Readonly<{
      kind: 'heading'
      level: 1 | 2 | 3 | 4
      inline: readonly MessageInline[]
      raw: string
    }>
  | Readonly<{
      kind: 'list'
      ordered: boolean
      start: number
      items: readonly (readonly MessageInline[])[]
      raw: string
    }>
  | Readonly<{ kind: 'quote'; inline: readonly MessageInline[]; raw: string }>
  | Readonly<{
      kind: 'code'
      language: string | undefined
      code: string
      /** False while the fence is still open and the text may still grow. */
      complete: boolean
      raw: string
    }>

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/
const HEADING = /^ {0,3}(#{1,4})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/
const ORDERED = /^ {0,3}(\d{1,9})[.)][ \t]+(.*)$/
const QUOTE = /^ {0,3}>[ \t]?(.*)$/

/** Only these schemes become links; everything else is shown as its text. */
export function safeHref(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) return undefined
  // Control characters and whitespace inside a URL are a scheme-smuggling vector.
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000- \u007f]/.test(trimmed)) return undefined
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
      ? trimmed
      : undefined
  } catch {
    return undefined
  }
}

const MAX_INLINE_DEPTH = 4

/** A marker may cite at most this many sources, so one cannot flood a sentence. */
const MAX_CITED_SOURCES = 6
const CITATION = /\[\^(\d{1,4}(?:[ \t]*,[ \t]*\d{1,4}){0,5})\]/y

export type ParseInlineOptions = {
  /** How many sources the host has. Without it no marker is a citation. */
  citations?: number
  /** Inside a link label, where a citation (itself a button) must not nest. */
  inLink?: boolean
}

function citationAt(text: string, index: number, count: number): MessageInline | undefined {
  CITATION.lastIndex = index
  const match = CITATION.exec(text)
  if (!match) return undefined
  const numbers = [...new Set(match[1]!.split(',').map((part) => Number(part.trim())))]
  if (numbers.length > MAX_CITED_SOURCES) return undefined
  if (numbers.some((number) => number < 1 || number > count)) return undefined
  return { kind: 'cite', numbers, raw: match[0] }
}

/** Inline spans. Delimiters must close on the same block, or they stay literal. */
export function parseInline(
  text: string,
  depth = 0,
  options: ParseInlineOptions = {}
): readonly MessageInline[] {
  const out: MessageInline[] = []
  let brackets: ReadonlyMap<number, number> | undefined
  let paren = -2
  let buffer = ''
  const flush = () => {
    if (buffer) out.push({ kind: 'text', text: buffer })
    buffer = ''
  }
  let index = 0
  while (index < text.length) {
    const char = text[index]!
    if (char === '`') {
      let ticks = 1
      while (text[index + ticks] === '`') ticks += 1
      const fence = '`'.repeat(ticks)
      const close = text.indexOf(fence, index + ticks)
      if (close > index + ticks) {
        flush()
        out.push({ kind: 'code', text: text.slice(index + ticks, close).replace(/^ (.*) $/, '$1') })
        index = close + ticks
        continue
      }
      buffer += fence
      index += ticks
      continue
    }
    if (depth < MAX_INLINE_DEPTH && (char === '*' || char === '_')) {
      const double = text[index + 1] === char
      const delimiter = double ? char + char : char
      const start = index + delimiter.length
      // Word-internal underscores cannot open emphasis. Reject before scanning,
      // and consume both marks so the second cannot rescan the remaining pairs.
      if (char === '_' && index > 0 && /[A-Za-z0-9]/.test(text[index - 1] ?? '')) {
        buffer += delimiter
        index = start
        continue
      }
      const next = text[start]
      // A delimiter opens only before a non-space, so `a * b * c` and `2 * 3` stay arithmetic.
      if (next !== undefined && !/\s/.test(next)) {
        const close = findClosing(text, delimiter, start)
        if (double && !(close > start && !/\s/.test(text[close - 1] ?? ' '))) {
          // An opener that does not close stays literal as a pair. Retrying its
          // second mark as emphasis would scan to the end of the line again, so a
          // line of unclosed `**a ` would be quadratic.
          buffer += delimiter
          index = start
          continue
        }
        if (close > start && !/\s/.test(text[close - 1] ?? ' ')) {
          flush()
          out.push({
            kind: double ? 'strong' : 'em',
            children: parseInline(text.slice(start, close), depth + 1, options),
          })
          index = close + delimiter.length
          continue
        }
      }
    }
    if (char === '[' && text[index + 1] === '^' && options.citations && !options.inLink) {
      const cite = citationAt(text, index, options.citations)
      if (cite && cite.kind === 'cite') {
        flush()
        out.push(cite)
        index += cite.raw.length
        continue
      }
    }
    if (depth < MAX_INLINE_DEPTH && char === '[') {
      brackets ??= bracketMatches(text)
      const labelEnd = brackets.get(index) ?? -1
      if (labelEnd > index && text[labelEnd + 1] === '(') {
        // The nearest `)` is remembered: a run of `[a](` with no `)` after it
        // would otherwise search to the end of the text from every opener.
        if (paren !== -1 && paren < labelEnd + 2) paren = text.indexOf(')', labelEnd + 2)
        const hrefEnd = paren
        if (hrefEnd > labelEnd + 1) {
          const href = safeHref(text.slice(labelEnd + 2, hrefEnd))
          if (href) {
            flush()
            out.push({
              kind: 'link',
              href,
              children: parseInline(text.slice(index + 1, labelEnd), depth + 1, {
                ...options,
                inLink: true,
              }),
            })
            index = hrefEnd + 1
            continue
          }
        }
      }
    }
    buffer += char
    index += 1
  }
  flush()
  return out
}

function findClosing(text: string, delimiter: string, from: number): number {
  let index = from
  while (index < text.length) {
    if (text[index] === '`') {
      // Skip a code span so `**a `**` b**` closes where the code ends.
      const close = text.indexOf('`', index + 1)
      if (close < 0) return -1
      index = close + 1
      continue
    }
    if (text[index] === delimiter[0]) {
      let end = index + 1
      while (text[end] === delimiter[0]) end += 1
      const run = end - index
      if (delimiter.length === 1) {
        // Emphasis closes on a run of one (or an odd run, whose last mark closes).
        // An even run is `**` pairs: strong spans inside the emphasis, which the
        // inner parse reads. One pass, and the scan stops at the next odd run, so
        // a line of unclosed delimiters is still linear.
        if (run % 2 === 1) return end - 1
      } else if (run >= delimiter.length) {
        // Strong closes on the last two marks of a run.
        return end - delimiter.length
      }
      index = end
      continue
    }
    index += 1
  }
  return -1
}

/**
 * The `]` that closes each `[`, found in one pass. A match never crosses a
 * newline, and an unmatched `[` has no entry. Scanning forward from every `[`
 * instead is quadratic on a long line of unclosed brackets, which a pasted page
 * or a hostile model can use to hang the renderer.
 */
function bracketMatches(text: string): ReadonlyMap<number, number> {
  const matches = new Map<number, number>()
  const open: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '[') open.push(index)
    else if (char === ']') {
      const start = open.pop()
      if (start !== undefined) matches.set(start, index)
    } else if (char === '\n') open.length = 0
  }
  return matches
}

/** Parse text into blocks. Pure, total, and linear in the length of `text`. */
export function parseMessageText(
  text: string,
  options: { streaming?: boolean; citations?: number } = {}
): readonly MessageBlock[] {
  const inline = (source: string) => parseInline(source, 0, { citations: options.citations })
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MessageBlock[] = []
  let paragraph: string[] = []
  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const raw = paragraph.join('\n')
    blocks.push({ kind: 'paragraph', inline: inline(raw), raw })
    paragraph = []
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    const fence = FENCE_OPEN.exec(line)
    if (fence) {
      flushParagraph()
      const marker = fence[1]!
      const language = fence[2] || undefined
      const body: string[] = []
      let closed = false
      index += 1
      while (index < lines.length) {
        const candidate = lines[index]!
        const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(candidate)
        if (close && close[1]![0] === marker[0] && close[1]!.length >= marker.length) {
          closed = true
          index += 1
          break
        }
        body.push(candidate)
        index += 1
      }
      const code = body.join('\n')
      blocks.push({
        kind: 'code',
        language,
        code,
        complete: closed || !options.streaming,
        raw: `${marker}${language ?? ''}\n${code}${closed ? `\n${marker}` : ''}`,
      })
      continue
    }
    if (line.trim() === '') {
      flushParagraph()
      index += 1
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flushParagraph()
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length as 1 | 2 | 3 | 4,
        inline: inline(heading[2]!),
        raw: line,
      })
      index += 1
      continue
    }
    const bullet = BULLET.exec(line)
    const ordered = bullet ? null : ORDERED.exec(line)
    if (bullet || ordered) {
      flushParagraph()
      const items: MessageInline[][] = []
      const rawLines: string[] = []
      const isOrdered = ordered !== null
      const start = ordered ? Number(ordered[1]) : 1
      while (index < lines.length) {
        const current = lines[index]!
        const match = isOrdered ? ORDERED.exec(current) : BULLET.exec(current)
        if (match) {
          items.push([...inline(isOrdered ? match[2]! : match[1]!)])
          rawLines.push(current)
          index += 1
          continue
        }
        // An indented continuation belongs to the previous item.
        if (/^ {2,}\S/.test(current) && items.length > 0) {
          items[items.length - 1] = [
            ...items[items.length - 1]!,
            { kind: 'text', text: ' ' },
            ...inline(current.trim()),
          ]
          rawLines.push(current)
          index += 1
          continue
        }
        break
      }
      blocks.push({ kind: 'list', ordered: isOrdered, start, items, raw: rawLines.join('\n') })
      continue
    }
    const quote = QUOTE.exec(line)
    if (quote) {
      flushParagraph()
      const quoted: string[] = []
      while (index < lines.length) {
        const match = QUOTE.exec(lines[index]!)
        if (!match) break
        quoted.push(match[1]!)
        index += 1
      }
      const raw = quoted.join('\n')
      blocks.push({ kind: 'quote', inline: inline(raw), raw })
      continue
    }
    paragraph.push(line)
    index += 1
  }
  flushParagraph()
  return blocks
}
