/**
 * Pure paste-token transformations translated and hardened from KiroCrew's
 * `website/src/utils/pasteTokens.ts` at revision
 * `283e136c0f902e965a535a7c9548c57c7504fed0` (Apache-2.0). See the #532 entry
 * in the repository NOTICE. Paste identity is supplied by the host; this module
 * does not access storage, clipboard APIs, message services, or editor state.
 */

/** A collapsed paste block stored alongside input or a message. */
export interface PasteBlock {
  /** A stable host-provided ASCII identifier; never included in visible token text. */
  id: string
  /** Positive safe integer, unique among blocks in the same text value. */
  seq: number
  /** Positive safe integer displayed in the token. */
  lines: number
  /** Original pasted text, retained verbatim. */
  content: string
}

export const PASTE_THRESHOLD_LINES = 3
export const PASTE_THRESHOLD_CHARS = 200

const PASTE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const MAX_SAFE_SEQUENCE_TEXT_LENGTH = String(Number.MAX_SAFE_INTEGER).length
const PASTE_TOKEN_SOURCE = String.raw`\[ Paste #([1-9]\d{0,${MAX_SAFE_SEQUENCE_TEXT_LENGTH - 1}}) · ([1-9]\d{0,${MAX_SAFE_SEQUENCE_TEXT_LENGTH - 1}}) lines \]`

/** Canonical token pattern. Internal scans always use a fresh RegExp instance. */
export const PASTE_TOKEN_REGEX = new RegExp(PASTE_TOKEN_SOURCE, 'g')

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

/** Check data received from a host before using it as a paste-token block. */
export function isPasteBlock(value: unknown): value is PasteBlock {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    PASTE_ID_PATTERN.test(candidate.id) &&
    isPositiveSafeInteger(candidate.seq) &&
    isPositiveSafeInteger(candidate.lines) &&
    typeof candidate.content === 'string'
  )
}

function unambiguousBlocks(blocks: readonly PasteBlock[]): PasteBlock[] {
  const valid = blocks.filter(isPasteBlock)
  const seqCounts = new Map<number, number>()
  const idCounts = new Map<string, number>()
  for (const block of valid) {
    seqCounts.set(block.seq, (seqCounts.get(block.seq) ?? 0) + 1)
    idCounts.set(block.id, (idCounts.get(block.id) ?? 0) + 1)
  }
  return valid.filter((block) => seqCounts.get(block.seq) === 1 && idCounts.get(block.id) === 1)
}

export function formatToken(block: PasteBlock): string {
  if (!isPasteBlock(block)) throw new TypeError('Cannot format an invalid paste block')
  return `[ Paste #${block.seq} · ${block.lines} lines ]`
}

export function shouldCollapse(text: string): boolean {
  if (!text) return false
  return countLines(text) >= PASTE_THRESHOLD_LINES || text.length >= PASTE_THRESHOLD_CHARS
}

export function countLines(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

/** Next sequence for a new paste = max existing + 1, starting at 1. */
export function nextSeq(blocks: readonly PasteBlock[]): number {
  let max = 0
  for (const block of blocks) {
    if (isPasteBlock(block) && block.seq > max) max = block.seq
  }
  if (max === Number.MAX_SAFE_INTEGER) throw new RangeError('Paste sequence space is exhausted')
  return max + 1
}

/**
 * Re-sequence `carried` blocks whose sequence is already taken by `used`, and
 * rewrite their markers in one right-to-left pass. Carried block IDs and
 * sequences must be unique so a visible marker always has one backing block.
 * `used` is mutated to include the assigned sequences.
 */
export function remapCarriedBlocks(
  text: string,
  carried: readonly PasteBlock[],
  used: Set<number>
): { text: string; blocks: PasteBlock[] } {
  const seenSeqs = new Set<number>()
  const seenIds = new Set<string>()
  for (const block of carried) {
    if (!isPasteBlock(block)) throw new TypeError('Cannot remap an invalid paste block')
    if (seenSeqs.has(block.seq) || seenIds.has(block.id)) {
      throw new TypeError('Carried paste block IDs and sequences must be unique')
    }
    seenSeqs.add(block.seq)
    seenIds.add(block.id)
  }

  let maxUsed = 0
  for (const value of used) {
    if (isPositiveSafeInteger(value) && value > maxUsed) maxUsed = value
  }
  let free = maxUsed < Number.MAX_SAFE_INTEGER ? maxUsed + 1 : 1
  const allocateFree = (): number => {
    while (used.has(free)) {
      free = free < Number.MAX_SAFE_INTEGER ? free + 1 : 1
    }
    const assigned = free
    used.add(assigned)
    free = assigned < Number.MAX_SAFE_INTEGER ? assigned + 1 : 1
    return assigned
  }

  const remap = new Map<number, number>()
  const blocks = carried.map((block) => {
    if (!used.has(block.seq)) {
      used.add(block.seq)
      return block
    }
    const seq = allocateFree()
    remap.set(block.seq, seq)
    return { ...block, seq }
  })

  if (!remap.size) return { text, blocks }

  let out = text
  const ranges = findTokenRanges(text, carried)
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const { start, end, block } = ranges[index]!
    const mapped = remap.get(block.seq)
    if (mapped === undefined) continue
    out = out.slice(0, start) + formatToken({ ...block, seq: mapped }) + out.slice(end)
  }
  return { text: out, blocks }
}

/** Ranges for canonical tokens whose sequence and line count match one block. */
export function findTokenRanges(
  text: string,
  blocks: readonly PasteBlock[]
): Array<{ start: number; end: number; block: PasteBlock }> {
  if (!text || !blocks.length) return []
  const bySeq = new Map(unambiguousBlocks(blocks).map((block) => [block.seq, block]))
  if (!bySeq.size) return []

  const tokenRegex = new RegExp(PASTE_TOKEN_SOURCE, 'g')
  const ranges: Array<{ start: number; end: number; block: PasteBlock }> = []
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(text)) !== null) {
    const seq = Number(match[1])
    const lines = Number(match[2])
    if (!isPositiveSafeInteger(seq) || !isPositiveSafeInteger(lines)) continue
    const block = bySeq.get(seq)
    if (block && block.lines === lines) {
      ranges.push({ start: match.index, end: match.index + match[0].length, block })
    }
  }
  return ranges
}

export function tokenRangeAt(
  text: string,
  blocks: readonly PasteBlock[],
  caret: number
): { start: number; end: number; block: PasteBlock } | null {
  if (!Number.isSafeInteger(caret) || caret < 0 || caret > text.length) return null
  for (const range of findTokenRanges(text, blocks)) {
    if (caret >= range.start && caret <= range.end) return range
  }
  return null
}

export function pruneBlocks(text: string, blocks: PasteBlock[]): PasteBlock[] {
  if (!blocks.length) return blocks
  const usable = unambiguousBlocks(blocks)
  const survivors = new Set(findTokenRanges(text, usable).map((range) => range.block.id))
  const next = usable.filter((block) => survivors.has(block.id))
  return next.length === blocks.length && next.every((block, index) => block === blocks[index])
    ? blocks
    : next
}

export function expandAll(text: string, blocks: readonly PasteBlock[]): string {
  if (!text || !blocks.length) return text
  const ranges = findTokenRanges(text, blocks)
  if (!ranges.length) return text
  let out = text
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index]!
    out = out.slice(0, range.start) + range.block.content + out.slice(range.end)
  }
  return out
}

/** Inverse of `expandAll`: replace each first non-overlapping verbatim block. */
export function recollapsePastes(content: string, blocks: readonly PasteBlock[]): string {
  if (!content || !blocks.length) return content

  interface Hit {
    start: number
    end: number
    block: PasteBlock
  }
  const hits: Hit[] = []
  const claimed: Array<[number, number]> = []
  const firstUnclaimed = (needle: string): number => {
    if (!needle) return -1
    let from = 0
    while (from <= content.length) {
      const index = content.indexOf(needle, from)
      if (index < 0) return -1
      if (!claimed.some(([start, end]) => index < end && index + needle.length > start))
        return index
      from = index + 1
    }
    return -1
  }

  for (const block of unambiguousBlocks(blocks)) {
    if (!block.content) continue
    const trimmed = block.content.trimEnd()
    let needle = block.content
    let index = firstUnclaimed(needle)
    if (index < 0 && trimmed && trimmed !== block.content) {
      needle = trimmed
      index = firstUnclaimed(needle)
    }
    if (index < 0) continue
    const end = index + needle.length
    hits.push({ start: index, end, block })
    claimed.push([index, end])
  }

  if (!hits.length) return content
  hits.sort((left, right) => left.start - right.start)
  let out = ''
  let position = 0
  for (const hit of hits) {
    if (hit.start < position) continue
    out += content.slice(position, hit.start) + formatToken(hit.block)
    position = hit.end
  }
  return out + content.slice(position)
}

/** Strip a trailing whitespace run only when that run contains a newline. */
export function stripTrailingBlankLines(value: string): string {
  let index = value.length - 1
  let sawNewline = false
  while (index >= 0) {
    const code = value.charCodeAt(index)
    if (code === 10 || code === 13) {
      sawNewline = true
      index -= 1
      continue
    }
    if (code === 32 || code === 9) {
      index -= 1
      continue
    }
    break
  }
  return sawNewline ? value.slice(0, index + 1) : value
}
