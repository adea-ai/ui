import { describe, expect, test } from 'bun:test'
import { formatDuration, reasoningTitle } from './reasoning'

describe('formatDuration', () => {
  test('formats seconds, minutes and hours', () => {
    expect(formatDuration(4)).toBe('4s')
    expect(formatDuration(59.4)).toBe('59s')
    expect(formatDuration(65)).toBe('1m 5s')
    expect(formatDuration(120)).toBe('2m')
    expect(formatDuration(3_725)).toBe('1h 2m')
    expect(formatDuration(7_200)).toBe('2h')
  })

  test('does not round a real duration down to nothing', () => {
    expect(formatDuration(0.2)).toBe('<1s')
  })

  test('makes no statement for a value that is not a duration', () => {
    expect(formatDuration(undefined)).toBeUndefined()
    expect(formatDuration(Number.NaN)).toBeUndefined()
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(formatDuration(-3)).toBeUndefined()
  })
})

describe('reasoningTitle', () => {
  test('names the state', () => {
    expect(reasoningTitle({ streaming: true })).toBe('Thinking…')
    expect(reasoningTitle({ duration: 4 })).toBe('Thought for 4s')
    expect(reasoningTitle({})).toBe('Reasoning')
  })

  test('streaming wins over a stale duration', () => {
    expect(reasoningTitle({ streaming: true, duration: 4 })).toBe('Thinking…')
  })

  test('an unusable duration falls back to the neutral title', () => {
    expect(reasoningTitle({ duration: Number.NaN })).toBe('Reasoning')
  })
})
