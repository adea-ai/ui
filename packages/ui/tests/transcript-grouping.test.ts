import { expect, test } from 'bun:test'
import {
  applyTranscriptRunningState,
  createTranscriptGrouper,
  groupTranscriptRows,
  type TranscriptRow,
} from '../src/components/conversation/transcript-grouping'

type Value = { text: string }
let sequence = 0
const row = (traits: Omit<TranscriptRow<Value>, 'id' | 'value'> = {}): TranscriptRow<Value> => ({
  id: `row-${++sequence}`,
  value: { text: 'host-redacted content' },
  ...traits,
})
const prompt = () => row({ opensTurn: 'reset' })
const step = () => row({ working: true })

test('keeps ordered contiguous groups and original indices without hiding approvals by default', () => {
  const first = row({ groupable: true })
  const second = row({ groupable: true })
  const divider = row()
  const last = row({ groupable: true })
  const result = groupTranscriptRows([first, second, row({ hidden: true }), divider, last])
  expect(result.turns).toEqual([
    {
      kind: 'turn',
      items: [
        { kind: 'group', rows: [first, second], startIndex: 0 },
        { kind: 'single', row: divider, index: 3 },
        { kind: 'group', rows: [last], startIndex: 4 },
      ],
      complete: true,
    },
  ])
  expect(result.trailingTurnIndex).toBe(0)
})

test('uses host-classified reset and continuation boundaries, preserving prompts outside turns', () => {
  const a = prompt()
  const continuation = row({ opensTurn: 'continue' })
  const b = prompt()
  const result = groupTranscriptRows([a, step(), step(), step(), continuation, step(), b])
  expect(result.turns.map((item) => item.kind)).toEqual([
    'single',
    'turn',
    'single',
    'single',
    'single',
  ])
  expect(result.trailingTurnIndex).toBe(-1)
})

test('wraps two content-bearing reasoning bursts even without working steps', () => {
  expect(
    groupTranscriptRows([row({ reasoning: true }), row({ reasoning: true })]).turns[0]?.kind
  ).toBe('turn')
  expect(
    groupTranscriptRows([row({ reasoning: true }), row()]).turns.map((item) => item.kind)
  ).toEqual(['single', 'single'])
})

test('running projection changes only the trailing turn and never mutates the grouping', () => {
  const grouped = groupTranscriptRows([
    prompt(),
    step(),
    step(),
    step(),
    prompt(),
    step(),
    step(),
    step(),
  ])
  const live = applyTranscriptRunningState(grouped, true)
  expect(live[1]).toBe(grouped.turns[1])
  const trailing = grouped.turns.at(-1)
  if (trailing?.kind !== 'turn') throw new Error('Fixture must end in a grouped turn')
  expect(live.at(-1)).toEqual({ ...trailing, complete: false })
  expect(grouped.turns.at(-1)).toHaveProperty('complete', true)
  expect(applyTranscriptRunningState(grouped, false)).toBe(grouped.turns)
})

test('synthesis folds interim work but never folds a proven answer into a later wave', () => {
  const answer = row({ working: true, turnEnd: true })
  const grouped = groupTranscriptRows([
    prompt(),
    step(),
    step(),
    step(),
    row({ synthesis: true }),
    answer,
    row({ opensTurn: 'continue' }),
    step(),
    step(),
    step(),
    row({ synthesis: true }),
    step(),
  ])
  const interim = grouped.turns.filter((item) => item.kind === 'turn' && item.interim)
  expect(interim).toHaveLength(2)
  for (const item of interim) {
    if (item.kind === 'turn')
      expect(item.items.some((entry) => entry.kind === 'single' && entry.row === answer)).toBe(
        false
      )
  }
  expect(grouped.turns.some((item) => item.kind === 'single' && item.row === answer)).toBe(true)
})

test('missing answer-boundary evidence and foreign injections retain visible unfolded work', () => {
  const unsafe = groupTranscriptRows([
    prompt(),
    step(),
    row({ foreign: true }),
    step(),
    row({ synthesis: true }),
  ])
  expect(unsafe.turns.some((item) => item.kind === 'turn' && item.interim)).toBe(false)
  const missing = groupTranscriptRows([
    prompt(),
    step(),
    step(),
    step(),
    row({ synthesis: true }),
    step(),
    row({ opensTurn: 'continue' }),
    step(),
    step(),
    step(),
    row({ synthesis: true }),
  ])
  expect(missing.turns.filter((item) => item.kind === 'turn' && item.interim)).toHaveLength(1)
})

test('reuses settled identities and the whole result when immutable inputs are unchanged', () => {
  const group = createTranscriptGrouper<Value>()
  const values = [prompt(), step(), step(), step(), prompt(), step(), step(), step()]
  const first = group(values)
  expect(group(values)).toBe(first)
  expect(group([...values])).toBe(first)
  const next = group([...values.slice(0, -1), row({ working: true })])
  expect(next.turns[1]).toBe(first.turns[1])
  expect(next.turns.at(-1)).not.toBe(first.turns.at(-1))
  expect(createTranscriptGrouper<Value>()(values)).not.toBe(first)
})

test('an injection after a proven answer still protects the following synthesis wave', () => {
  const answer = row({ turnEnd: true })
  const injection = row({ foreign: true })
  const grouped = groupTranscriptRows([
    prompt(),
    step(),
    step(),
    step(),
    row({ synthesis: true }),
    answer,
    injection,
    step(),
    step(),
    step(),
    row({ synthesis: true }),
  ])
  expect(grouped.turns.filter((item) => item.kind === 'turn' && item.interim)).toHaveLength(1)
  const flattened = grouped.turns.flatMap((item) => (item.kind === 'turn' ? item.items : [item]))
  expect(flattened.some((item) => item.kind === 'single' && item.row === injection)).toBe(true)
  expect(flattened.some((item) => item.kind === 'single' && item.row === answer)).toBe(true)
})

test('a new user prompt resets earlier contamination without mutating frozen host rows', () => {
  const values = Object.freeze([
    Object.freeze(row({ foreign: true })),
    Object.freeze(prompt()),
    Object.freeze(step()),
    Object.freeze(step()),
    Object.freeze(step()),
    Object.freeze(row({ synthesis: true })),
  ])
  const grouped = groupTranscriptRows(values)
  expect(grouped.turns.filter((item) => item.kind === 'turn' && item.interim)).toHaveLength(1)
  expect(values).toHaveLength(6)
  expect(values[0]?.foreign).toBe(true)
})

test('unknown rows stay visible and an ungrouped tail has no running projection', () => {
  const unknown = row()
  const grouped = groupTranscriptRows([unknown])
  expect(grouped.turns).toEqual([{ kind: 'single', row: unknown, index: 0 }])
  expect(grouped.trailingTurnIndex).toBe(-1)
  expect(applyTranscriptRunningState(grouped, true)).toBe(grouped.turns)
})
