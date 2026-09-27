/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 *
 * Adapted from KiroCrew TurnBlock.tsx at
 * 283e136c0f902e965a535a7c9548c57c7504fed0. Host classifications replace
 * protocol parsing; approval capability and payload ownership stay outside UI.
 */
import type { TranscriptRow } from './transcript-grouping'

export type TranscriptFoldMode = 'tools' | 'prose' | 'interim'
export type TranscriptMounting = 'always' | 'unmount-when-collapsed' | 'hide-when-collapsed'
export type TranscriptFoldPlan<T> = Readonly<{
  entries: readonly Readonly<{ row: TranscriptRow<T>; mounting: TranscriptMounting }>[]
  callCount: number
  foldableCount: number
}>

/**
 * Ordered mount policy, shared by tool and prose disclosure. Unknown rows and
 * actionable payloads remain visible. A missing answer boundary keeps prose
 * visible rather than implying that an answer appears elsewhere.
 */
export function planTranscriptFold<T>(
  rows: readonly TranscriptRow<T>[],
  options: Readonly<{ mode: TranscriptFoldMode; settled: boolean }>
): TranscriptFoldPlan<T> {
  let conclusion = -1
  for (let index = 0; index < rows.length; index++) if (rows[index]?.conclusion) conclusion = index
  const requestIds = new Set<string>()
  let callCount = 0
  for (const row of rows) {
    const eligible = !row.alwaysVisible && row.fold !== undefined
    if (eligible && row.fold === 'tool' && row.call?.phase === 'request') {
      const id = row.call.id
      if (id === undefined || !requestIds.has(id)) {
        callCount++
        if (id !== undefined) requestIds.add(id)
      }
    }
  }
  let foldableCount = 0
  const entries = rows.map((row, index) => {
    const eligible = !row.alwaysVisible && row.fold !== undefined
    let mounting: TranscriptMounting = 'always'
    if (options.settled && eligible) {
      if (options.mode === 'tools' && callCount > 0 && row.fold === 'tool')
        mounting = 'unmount-when-collapsed'
      else if (
        options.mode === 'interim' ||
        (options.mode === 'prose' && conclusion >= 0 && index < conclusion)
      )
        mounting = 'hide-when-collapsed'
    }
    if (mounting !== 'always') foldableCount++
    return { row, mounting }
  })
  return { entries, callCount, foldableCount }
}
