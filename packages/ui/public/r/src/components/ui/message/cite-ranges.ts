import { parseMessageText, type MessageBlock, type MessageInline } from './parse-message-text'

/**
 * Citations that arrive as positions in the text, placed as markers.
 *
 * A producer that cites a passage says *where*: a half-open span of the exact
 * text and the sources behind it. `MessageText` binds `[^n]` markers, so this
 * turns the one into the other without ever changing what the text says:
 *
 * - A marker goes at the **end** of the span, nowhere else, and only for numbers
 *   within `count`. Several spans ending at one place share one marker.
 * - **The parser is the judge of where a marker may go.** The text is parsed
 *   without the markers and again with them; a marker is kept only if everything
 *   that is not a marker reads exactly as before. A position inside a code
 *   block, an inline code span, a link target or anything else the parser reads
 *   as something other than prose changes that reading, so it is dropped (the
 *   source still belongs in `Sources`; it just has no badge there). No second
 *   copy of the Markdown rules exists to drift from the real one.
 * - **Text that already has footnote marks gets none.** `[^1]` typed by a model
 *   would otherwise be indistinguishable from a marker placed here, and a
 *   citation must never come from the text alone.
 *
 * The result's `text` is for display only. Copy the original.
 */
export type CitationPlacement = Readonly<{
  /** Offset into the text after which the marker goes (the span's end). */
  end: number
  /** 1-based positions in the host's source list. */
  numbers: readonly number[]
}>

export type PlacedCitations = Readonly<{
  /** The text with markers, for `MessageText` with `citations`. */
  text: string
  /** Distinct end positions that received a marker. */
  placed: number
  /** Distinct end positions left without one, for any reason. */
  skipped: number
  /** The text had footnote marks of its own, so nothing was placed. */
  collision: boolean
}>

const FOOTNOTE = /\[\^\d/
const PER_MARKER = 6

function marker(numbers: readonly number[]): string {
  const parts: string[] = []
  for (let index = 0; index < numbers.length; index += PER_MARKER) {
    parts.push(`[^${numbers.slice(index, index + PER_MARKER).join(',')}]`)
  }
  return parts.join('')
}

function normalise(nodes: readonly MessageInline[]): unknown[] {
  const out: unknown[] = []
  for (const node of nodes) {
    if (node.kind === 'cite') continue
    if (node.kind === 'strong' || node.kind === 'em' || node.kind === 'link') {
      out.push({ ...node, children: normalise(node.children) })
      continue
    }
    const last = out.at(-1) as { kind?: string; text?: string } | undefined
    if (node.kind === 'text' && last?.kind === 'text') {
      out[out.length - 1] = { kind: 'text', text: `${last.text}${node.text}` }
    } else {
      out.push(node)
    }
  }
  return out
}

/** What the blocks say with the markers and every `raw` slice taken out. */
function reading(blocks: readonly MessageBlock[]): string {
  return JSON.stringify(
    blocks.map((block) => {
      const { raw: _raw, ...rest } = block
      if (block.kind === 'list') return { ...rest, items: block.items.map(normalise) }
      if (block.kind === 'code') return rest
      return { ...rest, inline: normalise(block.inline) }
    })
  )
}

export function placeCitationMarkers(
  text: string,
  citations: readonly CitationPlacement[],
  count: number
): PlacedCitations {
  const byEnd = new Map<number, Set<number>>()
  for (const { end, numbers } of citations) {
    if (!Number.isInteger(end) || end <= 0 || end > text.length) continue
    for (const number of numbers) {
      if (!Number.isInteger(number) || number < 1 || number > count) continue
      const set = byEnd.get(end) ?? new Set<number>()
      set.add(number)
      byEnd.set(end, set)
    }
  }
  const candidates = [...byEnd.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([end, numbers]) => ({ end, marker: marker([...numbers].toSorted((a, b) => a - b)) }))
  if (candidates.length === 0) return { text, placed: 0, skipped: 0, collision: false }
  if (FOOTNOTE.test(text)) {
    return { text, placed: 0, skipped: candidates.length, collision: true }
  }

  const insert = (chosen: readonly { end: number; marker: string }[]): string => {
    let out = ''
    let cursor = 0
    for (const item of chosen) {
      out += text.slice(cursor, item.end) + item.marker
      cursor = item.end
    }
    return out + text.slice(cursor)
  }

  const baseline = reading(parseMessageText(text))
  const holds = (chosen: readonly { end: number; marker: string }[]) =>
    reading(parseMessageText(insert(chosen), { citations: count })) === baseline

  // Usual case: every position is prose, one check covers all of them.
  if (holds(candidates)) {
    return { text: insert(candidates), placed: candidates.length, skipped: 0, collision: false }
  }
  const accepted: { end: number; marker: string }[] = []
  for (const candidate of candidates) {
    if (holds([...accepted, candidate])) accepted.push(candidate)
  }
  return {
    text: insert(accepted),
    placed: accepted.length,
    skipped: candidates.length - accepted.length,
    collision: false,
  }
}
