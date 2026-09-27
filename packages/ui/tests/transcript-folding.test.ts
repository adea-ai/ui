import { expect, test } from 'bun:test'
import { planTranscriptFold } from '../src/components/conversation/transcript-folding'
import type { TranscriptRow } from '../src/components/conversation/transcript-grouping'

const row = (id: string, traits: Partial<TranscriptRow<string>> = {}): TranscriptRow<string> => ({
  id,
  value: id,
  ...traits,
})

test('default tool folds unmount tools but keep actionable rows in original order', () => {
  const rows = [
    row('request', { fold: 'tool', call: { phase: 'request', id: 'a' } }),
    row('approval', { fold: 'tool', alwaysVisible: true }),
    row('result', { fold: 'tool', call: { phase: 'result', id: 'a' } }),
    row('answer'),
  ]
  const plan = planTranscriptFold(rows, { mode: 'tools', settled: true })
  expect(plan.entries.map(({ row: entry, mounting }) => [entry.id, mounting])).toEqual([
    ['request', 'unmount-when-collapsed'],
    ['approval', 'always'],
    ['result', 'unmount-when-collapsed'],
    ['answer', 'always'],
  ])
  expect(plan.callCount).toBe(1)
})

test('prose folds keep payloads mounted and retain the host-designated conclusion', () => {
  const plan = planTranscriptFold(
    [
      row('thinking', { fold: 'prose' }),
      row('image', { fold: 'prose', alwaysVisible: true }),
      row('answer', { fold: 'prose', conclusion: true }),
      row('follow-up', { fold: 'prose' }),
    ],
    { mode: 'prose', settled: true }
  )
  expect(plan.entries.map(({ row: entry, mounting }) => [entry.id, mounting])).toEqual([
    ['thinking', 'hide-when-collapsed'],
    ['image', 'always'],
    ['answer', 'always'],
    ['follow-up', 'always'],
  ])
})

test('collapse-all retains the answer while interim prose remains mounted', () => {
  const rows = [
    row('interim reasoning', { fold: 'prose' }),
    row('answer', { fold: 'prose', conclusion: true }),
  ]
  const collapseAll = planTranscriptFold(rows, { mode: 'prose', settled: true })
  expect(collapseAll.entries.map(({ row: entry, mounting }) => [entry.id, mounting])).toEqual([
    ['interim reasoning', 'hide-when-collapsed'],
    ['answer', 'always'],
  ])
  const interim = planTranscriptFold(rows, { mode: 'interim', settled: true })
  expect(interim.entries.map(({ mounting }) => mounting)).toEqual(['hide-when-collapsed', 'always'])
})

test('interim scope keeps a synthesis conclusion visible beside foldable activity', () => {
  const rows = [
    row('interim-tool-request', {
      working: true,
      fold: 'tool',
      call: { phase: 'request', id: 'call-1' },
    }),
    row('interim-tool-result', {
      working: true,
      fold: 'tool',
      call: { phase: 'result', id: 'call-1' },
    }),
    row('interim-work', { working: true, fold: 'prose' }),
    row('synthesis', { synthesis: true, fold: 'prose' }),
    row('final-answer', { fold: 'prose', conclusion: true }),
  ]

  const interim = planTranscriptFold(rows, { mode: 'interim', settled: true })
  expect(interim.entries.map(({ row: entry, mounting }) => [entry.id, mounting])).toEqual([
    ['interim-tool-request', 'hide-when-collapsed'],
    ['interim-tool-result', 'hide-when-collapsed'],
    ['interim-work', 'hide-when-collapsed'],
    ['synthesis', 'hide-when-collapsed'],
    ['final-answer', 'always'],
  ])
})

test('missing conclusion evidence leaves prose visible; interim folds are explicitly classified', () => {
  const rows = [row('reasoning', { fold: 'prose' }), row('unknown')]
  expect(
    planTranscriptFold(rows, { mode: 'prose', settled: true }).entries.every(
      (entry) => entry.mounting === 'always'
    )
  ).toBe(true)
  expect(
    planTranscriptFold(rows, { mode: 'interim', settled: true }).entries.map(
      (entry) => entry.mounting
    )
  ).toEqual(['hide-when-collapsed', 'always'])
})

test('running work stays visible and counts only explicitly classified distinct requests', () => {
  const rows = [
    row('one', { fold: 'tool', call: { phase: 'request', id: 'a' } }),
    row('duplicate', { fold: 'tool', call: { phase: 'request', id: 'a' } }),
    row('result', { fold: 'tool', call: { phase: 'result', id: 'b' } }),
    row('legacy', { fold: 'tool', call: { phase: 'request' } }),
    row('unknown', { fold: 'tool' }),
  ]
  const plan = planTranscriptFold(rows, { mode: 'tools', settled: false })
  expect(plan.entries.every((entry) => entry.mounting === 'always')).toBe(true)
  expect(plan.callCount).toBe(2)
})

test('result-only and unclassified tool rows cannot produce an empty call fold', () => {
  const plan = planTranscriptFold(
    [
      row('result', { fold: 'tool', call: { phase: 'result', id: 'a' } }),
      row('unknown', { fold: 'tool' }),
    ],
    { mode: 'tools', settled: true }
  )
  expect(plan.callCount).toBe(0)
  expect(plan.entries.every((entry) => entry.mounting === 'always')).toBe(true)
  expect(plan.foldableCount).toBe(0)
})
