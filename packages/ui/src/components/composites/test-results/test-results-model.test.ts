import { describe, expect, test } from 'bun:test'
import {
  describeCount,
  firstFailureKey,
  formatDuration,
  listedCounts,
  reconcileCounts,
  suiteKey,
  suiteState,
  testKey,
  type ListedCounts,
  type TestSuite,
} from './test-results-model'

const suites: TestSuite[] = [
  {
    name: 'keyed rows',
    tests: [
      { name: 'keeps rows', status: 'passed' },
      { name: 'drops a row', status: 'passed' },
      { name: 'reuses a repeated key', status: 'failed' },
      { name: 'ignores nothing', status: 'skipped' },
    ],
    suites: [
      {
        name: 'nested',
        tests: [
          { name: 'still running', status: 'running' },
          { name: 'no status given' },
          { name: 'waiting', status: 'pending' },
        ],
      },
    ],
  },
]

const none: ListedCounts = {
  passed: 0,
  failed: 0,
  skipped: 0,
  running: 0,
  pending: 0,
  unknown: 0,
  total: 0,
}

describe('listedCounts', () => {
  test('counts every status at every depth, and tests with none', () => {
    expect(listedCounts(suites)).toEqual({
      passed: 2,
      failed: 1,
      skipped: 1,
      running: 1,
      pending: 1,
      unknown: 1,
      total: 7,
    })
  })

  test('an invented status counts as none', () => {
    expect(
      listedCounts([{ name: 's', tests: [{ name: 't', status: 'exploded' as never }] }])
    ).toEqual({
      ...none,
      unknown: 1,
      total: 1,
    })
  })

  test('is all zeros for no suites, suites with no tests, and deep nesting', () => {
    expect(listedCounts([])).toEqual(none)
    expect(listedCounts([{ name: 'empty' }])).toEqual(none)
    let deep: TestSuite = { name: 'leaf', tests: [{ name: 't', status: 'passed' }] }
    for (let i = 0; i < 20_000; i += 1) deep = { name: `n${i}`, suites: [deep] }
    expect(listedCounts([deep]).passed).toBe(1)
  })
})

describe('reconcileCounts', () => {
  const listed = listedCounts(suites)

  test('shows the host counts as given when they agree with the list', () => {
    const result = reconcileCounts({ passed: 2, failed: 1, skipped: 1 }, listed)
    expect(result.basis).toBe('reported')
    expect(result.lines.map((line) => [line.outcome, line.count, line.differs])).toEqual([
      ['failed', 1, false],
      ['passed', 2, false],
      ['skipped', 1, false],
    ])
  })

  test('shows a disagreeing count as given and notes the listed number', () => {
    const result = reconcileCounts({ passed: 40, failed: 1 }, listed)
    const passed = result.lines.find((line) => line.outcome === 'passed')!
    expect(passed).toMatchObject({ count: 40, listed: 2, differs: true })
    expect(describeCount(passed)).toBe('40 passed (2 listed)')
    expect(describeCount(result.lines.find((line) => line.outcome === 'failed')!)).toBe('1 failed')
  })

  test('an outcome the host did not report is not invented from the list', () => {
    const result = reconcileCounts({ failed: 1 }, listed)
    expect(result.lines.map((line) => line.outcome)).toEqual(['failed'])
  })

  test('when nothing is listed there is nothing to disagree with', () => {
    const result = reconcileCounts({ passed: 40, failed: 2, total: 42 }, none)
    expect(result.lines.every((line) => !line.differs)).toBe(true)
    expect(result.totalNote).toBeUndefined()
  })

  test('a failures-only list says so by showing zero listed', () => {
    const failuresOnly = listedCounts([{ name: 's', tests: [{ name: 'a', status: 'failed' }] }])
    const result = reconcileCounts({ passed: 40, failed: 1 }, failuresOnly)
    expect(describeCount(result.lines.find((line) => line.outcome === 'passed')!)).toBe(
      '40 passed (0 listed)'
    )
  })

  test('a reported total that differs from the list is noted', () => {
    expect(reconcileCounts({ total: 100 }, listed).totalNote).toEqual({ reported: 100, listed: 7 })
    expect(reconcileCounts({ total: 7 }, listed).totalNote).toBeUndefined()
  })

  test('without a summary the counts come from the list and say so', () => {
    const result = reconcileCounts(undefined, listed)
    expect(result.basis).toBe('listed')
    expect(result.lines.map((line) => [line.outcome, line.count])).toEqual([
      ['failed', 1],
      ['passed', 2],
      ['skipped', 1],
    ])
    expect(reconcileCounts({ durationMs: 12 }, listed).basis).toBe('listed')
  })

  test('no summary and no tests has no counts at all', () => {
    expect(reconcileCounts(undefined, none)).toEqual({ basis: 'listed', lines: [] })
  })

  test('ignores counts that are not non-negative integers', () => {
    const result = reconcileCounts(
      { passed: -1, failed: 1.5, skipped: Number.NaN, total: '9' as never },
      listed
    )
    expect(result.basis).toBe('listed')
  })
})

describe('formatDuration', () => {
  test('short form', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(0.31)).toBe('<1 ms')
    expect(formatDuration(120.4)).toBe('120 ms')
    expect(formatDuration(999.6)).toBe('1000 ms')
    expect(formatDuration(1000)).toBe('1 s')
    expect(formatDuration(3400)).toBe('3.4 s')
    expect(formatDuration(12_400)).toBe('12 s')
    expect(formatDuration(60_000)).toBe('1 min')
    expect(formatDuration(125_000)).toBe('2 min 5 s')
  })

  test('long form is words', () => {
    expect(formatDuration(0.5, 'long')).toBe('less than 1 millisecond')
    expect(formatDuration(1, 'long')).toBe('1 millisecond')
    expect(formatDuration(120, 'long')).toBe('120 milliseconds')
    expect(formatDuration(1000, 'long')).toBe('1 second')
    expect(formatDuration(3400, 'long')).toBe('3.4 seconds')
    expect(formatDuration(61_000, 'long')).toBe('1 minute 1 second')
    expect(formatDuration(125_000, 'long')).toBe('2 minutes 5 seconds')
    expect(formatDuration(120_000, 'long')).toBe('2 minutes')
  })

  test('has no duration for anything that is not a duration', () => {
    for (const bad of [undefined, null, -1, Number.NaN, Infinity, '12', {}]) {
      expect(formatDuration(bad)).toBeUndefined()
    }
  })
})

describe('suiteState', () => {
  test('a failure wins, then running, then a clean pass', () => {
    expect(suiteState({ ...none, passed: 3, failed: 1, total: 4 })).toBe('failed')
    expect(suiteState({ ...none, passed: 3, running: 1, total: 4 })).toBe('running')
    expect(suiteState({ ...none, passed: 3, skipped: 1, total: 4 })).toBe('passed')
  })

  test('says nothing without evidence', () => {
    expect(suiteState(none)).toBeUndefined()
    expect(suiteState({ ...none, skipped: 2, total: 2 })).toBeUndefined()
    expect(suiteState({ ...none, passed: 2, unknown: 1, total: 3 })).toBeUndefined()
    expect(suiteState({ ...none, passed: 2, pending: 1, total: 3 })).toBeUndefined()
  })
})

describe('keys and the first failure', () => {
  test('keys use ids when present and positions otherwise', () => {
    expect(suiteKey('', { name: 'a', id: 'x' }, 3)).toBe('/x')
    expect(suiteKey('/x', { name: 'a' }, 3)).toBe('/x/s3')
    expect(testKey('/x', { name: 't', id: 'y' }, 1)).toBe('/x:y')
    expect(testKey('/x', { name: 't' }, 1)).toBe('/x:t1')
  })

  test('finds the first failing test in reading order, including nested suites', () => {
    expect(firstFailureKey(suites)).toBe('/s0:t2')
    expect(
      firstFailureKey([
        { name: 'a', tests: [{ name: 'ok', status: 'passed' }] },
        {
          name: 'b',
          suites: [
            {
              name: 'deep',
              tests: [
                { name: 'x', status: 'passed' },
                { name: 'bad', status: 'failed' },
              ],
            },
          ],
        },
      ])
    ).toBe('/s1/s0:t1')
  })

  test('is undefined when nothing failed', () => {
    expect(
      firstFailureKey([{ name: 'a', tests: [{ name: 'ok', status: 'passed' }] }])
    ).toBeUndefined()
    expect(firstFailureKey([])).toBeUndefined()
  })

  test('a nested suite is searched before the next sibling', () => {
    const key = firstFailureKey([
      { name: 'a', suites: [{ name: 'inner', tests: [{ name: 'bad', status: 'failed' }] }] },
      { name: 'b', tests: [{ name: 'worse', status: 'failed' }] },
    ])
    expect(key).toBe('/s0/s0:t0')
  })
})
