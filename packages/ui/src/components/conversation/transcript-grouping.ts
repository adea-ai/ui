/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 *
 * Substantially translated from KiroCrew groupDisplayItems.ts at
 * 283e136c0f902e965a535a7c9548c57c7504fed0. Protocol classification is supplied
 * by the host; no Kiro role, metadata parser, store, or transport is imported.
 */

/** Immutable, already-redacted host rows. Unknown rows remain visible singles. */
export type TranscriptRow<T> = Readonly<{
  id: string
  value: T
  hidden?: boolean
  groupable?: boolean
  working?: boolean
  /** True only for a content-bearing reasoning trace, never an empty placeholder. */
  reasoning?: boolean
  opensTurn?: 'reset' | 'continue'
  synthesis?: boolean
  /** A proven answer boundary, supplied by the host rather than inferred from text. */
  turnEnd?: boolean
  /** Content that a synthesis does not restate; prevents interim folding. */
  foreign?: boolean
  /** Explicit host eligibility; unknown content never folds. */
  fold?: 'tool' | 'prose'
  /** Errors, approvals, questions, diffs, renderables and interactive payloads bypass every fold. */
  alwaysVisible?: boolean
  /** A host-designated substantive answer. No text-length or role heuristic is applied. */
  conclusion?: boolean
  /** Request/result classification is supplied by the host, never parsed from display text. */
  call?: Readonly<{ phase: 'request' | 'result'; id?: string }>
}>

export type TranscriptTurnItem<T> =
  | Readonly<{ kind: 'single'; row: TranscriptRow<T>; index: number }>
  | Readonly<{ kind: 'group'; rows: readonly TranscriptRow<T>[]; startIndex: number }>

export type TranscriptDisplayItem<T> =
  | TranscriptTurnItem<T>
  | Readonly<{
      kind: 'turn'
      items: readonly TranscriptTurnItem<T>[]
      /** Presentation bookkeeping, never evidence of successful runtime completion. */
      complete: boolean
      interim?: boolean
    }>

export type GroupedTranscript<T> = Readonly<{
  turns: readonly TranscriptDisplayItem<T>[]
  trailingTurnIndex: number
}>

/** Ordered O(N) grouping; approvals are retained unless their host explicitly owns them elsewhere. */
export function groupTranscriptRows<T>(rows: readonly TranscriptRow<T>[]): GroupedTranscript<T> {
  const raw: TranscriptTurnItem<T>[] = []
  let group: TranscriptRow<T>[] = []
  let groupStart = 0
  rows.forEach((row, index) => {
    if (row.hidden) return
    if (row.groupable) {
      if (!group.length) groupStart = index
      group.push(row)
    } else {
      if (group.length) {
        raw.push({ kind: 'group', rows: group, startIndex: groupStart })
        group = []
      }
      raw.push({ kind: 'single', row, index })
    }
  })
  if (group.length) raw.push({ kind: 'group', rows: group, startIndex: groupStart })

  const turns: TranscriptDisplayItem<T>[] = []
  let items: TranscriptTurnItem<T>[] = []
  let regionStart = 0
  let foreign = false
  let pendingAnswer = false
  const flush = (batch: TranscriptTurnItem<T>[]) => {
    const working = batch.some((item) => item.kind === 'group' || item.row.working)
    const reasoning = batch.reduce(
      (count, item) => count + Number(item.kind === 'single' && item.row.reasoning === true),
      0
    )
    if ((working && batch.length > 2) || reasoning >= 2)
      turns.push({ kind: 'turn', items: batch, complete: true })
    else turns.push(...batch)
  }
  const foldInterim = () => {
    const region = turns.splice(regionStart)
    const folded = region.flatMap((item) => (item.kind === 'turn' ? [...item.items] : [item]))
    if (folded.length) turns.push({ kind: 'turn', items: folded, complete: true, interim: true })
  }
  const settleAnswer = () => {
    if (!pendingAnswer) return
    const end = items.findIndex((item) => item.kind === 'single' && item.row.turnEnd)
    if (end >= 0) {
      flush(items.slice(0, end + 1))
      items = items.slice(end + 1)
      regionStart = turns.length
      // Recompute from retained rows: an unrelated injection after the answer
      // must still protect the next wave, while an earlier one must not poison it.
      foreign = items.some((item) => item.kind === 'single' && item.row.foreign)
    } else foreign = true
    pendingAnswer = false
  }
  for (const item of raw) {
    if (item.kind === 'single' && item.row.synthesis) {
      settleAnswer()
      if (items.length) {
        flush(items)
        items = []
      }
      if (!foreign) foldInterim()
      items.push(item)
      regionStart = turns.length
      pendingAnswer = true
      continue
    }
    if (item.kind === 'single' && item.row.foreign) foreign = true
    if (item.kind === 'single' && item.row.opensTurn) {
      settleAnswer()
      if (items.length) {
        flush(items)
        items = []
      }
      turns.push(item)
      if (item.row.opensTurn === 'reset') {
        regionStart = turns.length
        foreign = false
        pendingAnswer = false
      }
      continue
    }
    items.push(item)
  }
  let trailingTurnIndex = -1
  if (items.length) {
    const before = turns.length
    flush(items)
    if (turns.length === before + 1 && turns.at(-1)?.kind === 'turn')
      trailingTurnIndex = turns.length - 1
  }
  return { turns, trailingTurnIndex }
}

function sameItem<T>(a: TranscriptTurnItem<T>, b: TranscriptTurnItem<T>): boolean {
  if (a.kind === 'single') return b.kind === 'single' && a.row === b.row && a.index === b.index
  if (b.kind !== 'group' || a.startIndex !== b.startIndex || a.rows.length !== b.rows.length)
    return false
  return a.rows.every((row, index) => row === b.rows[index])
}

function sameDisplayItem<T>(a: TranscriptDisplayItem<T>, b: TranscriptDisplayItem<T>): boolean {
  if (a.kind === 'turn') {
    return (
      b.kind === 'turn' &&
      a.complete === b.complete &&
      !!a.interim === !!b.interim &&
      a.items.length === b.items.length &&
      a.items.every((item, index) => sameItem(item, b.items[index]!))
    )
  }
  return b.kind !== 'turn' && sameItem(a, b)
}

/** One previous immutable input/result pair per caller; no global or growing transcript cache. */
export function createTranscriptGrouper<T>(): (
  rows: readonly TranscriptRow<T>[]
) => GroupedTranscript<T> {
  let previousRows: readonly TranscriptRow<T>[] | undefined
  let previous: GroupedTranscript<T> | undefined
  return (rows) => {
    if (previous && rows === previousRows) return previous
    const fresh = groupTranscriptRows(rows)
    const turns = [...fresh.turns]
    let allReused =
      previous?.turns.length === turns.length &&
      previous.trailingTurnIndex === fresh.trailingTurnIndex
    if (previous) {
      for (let index = 0; index < turns.length; index++) {
        const candidate = previous.turns[index]
        if (candidate && sameDisplayItem(turns[index]!, candidate)) turns[index] = candidate
        else allReused = false
      }
    }
    previousRows = rows
    if (previous && allReused) return previous
    previous = { turns, trailingTurnIndex: fresh.trailingTurnIndex }
    return previous
  }
}

/** Shallow-copies the display list and changes only its trailing turn. The host supplies running authority. */
export function applyTranscriptRunningState<T>(
  grouped: GroupedTranscript<T>,
  running: boolean
): readonly TranscriptDisplayItem<T>[] {
  if (grouped.trailingTurnIndex < 0 || !running) return grouped.turns
  const turns = [...grouped.turns]
  const trailing = turns[grouped.trailingTurnIndex]
  if (trailing?.kind === 'turn') turns[grouped.trailingTurnIndex] = { ...trailing, complete: false }
  return turns
}
