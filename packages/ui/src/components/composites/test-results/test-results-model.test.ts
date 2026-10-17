import { describe, expect, test } from 'bun:test'
import {
  boundedEntries,
  describeCount,
  firstFailureKey,
  firstFailureRenderPath,
  formatDuration,
  listedCounts,
  reconcileCounts,
  repeatedKey,
  sameFailure,
  siblingKey,
  suiteKey,
  suiteState,
  testKey,
  type ListedCounts,
  type TestSuite,
} from './test-results-model'

const chain = (depth: number, leaf: TestSuite): TestSuite => {
  let node = leaf
  for (let level = depth; level > 0; level -= 1)
    node = { id: 'same', name: `level ${level}`, suites: [node] }
  return node
}

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
    expect(result.reportedTotal).toBe(42)
    expect(result.totalNote).toBeUndefined()
  })

  test('keeps a supplied total when no outcome counts or tests are listed', () => {
    const result = reconcileCounts({ total: 10 }, none)
    expect(result).toEqual({ basis: 'reported', lines: [], reportedTotal: 10 })
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

  test('returns the complete keyed ancestor path for the first failure', () => {
    const values: TestSuite[] = [
      {
        id: 'outer',
        name: 'outer',
        suites: [
          {
            id: 'inner',
            name: 'inner',
            tests: [{ id: 'broken', name: 'broken', status: 'failed' }],
          },
        ],
      },
    ]
    expect(firstFailureRenderPath(values)).toEqual({
      suites: [repeatedKey('iouter', 0), repeatedKey('iinner', 0)],
      test: repeatedKey('ibroken', 0),
    })
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

  test('render keys distinguish duplicate stable ids by their sibling occurrence', () => {
    const values = [
      {
        name: 'same',
        id: 'suite',
        tests: [{ name: 'first', id: 'test', status: 'passed' as const }],
      },
      {
        name: 'same',
        id: 'suite',
        tests: [{ name: 'second', id: 'test', status: 'failed' as const }],
      },
    ]
    expect(firstFailureRenderPath(values)).toEqual({
      suites: [repeatedKey('isuite', 1)],
      test: repeatedKey('itest', 0),
    })
    expect(
      firstFailureRenderPath([
        { ...values[1]!, tests: [{ ...values[1]!.tests![0]!, status: 'failed' }] },
      ])
    ).toEqual({ suites: [repeatedKey('isuite', 0)], test: repeatedKey('itest', 0) })
    expect(firstFailureKey(values)).toBe('/suite:test')
  })

  test('bounded entries key only the visible prefix and keep duplicate ids distinct', () => {
    const items = [
      { id: 'same', name: 'first' },
      { id: 'same', name: 'second' },
      { id: 'later', name: 'hidden' },
    ]
    const itemKey = (item: (typeof items)[number]) => `/${item.id}`
    const firstPage = boundedEntries(items, 1, itemKey)

    expect(firstPage.entries.map((entry) => entry.key)).toEqual([repeatedKey('/same', 0)])
    expect(firstPage.byKey.size).toBe(1)
    expect(firstPage.byKey.has(repeatedKey('/same', 1))).toBe(false)
    expect(firstPage.byKey.has('/later')).toBe(false)

    const expandedPage = boundedEntries(items, 2, itemKey)
    expect(expandedPage.entries[0]!.key).toBe(firstPage.entries[0]!.key)
    expect(expandedPage.entries[1]!.key).toBe(repeatedKey('/same', 1))
    expect(expandedPage.byKey.get(repeatedKey('/same', 1))?.item).toBe(items[1])
  })

  describe('rendering keys stay linear and collision safe', () => {
    const failing: TestSuite = {
      id: 'leaf',
      name: 'leaf',
      tests: [{ id: 'broken', name: 'broken', status: 'failed' }],
    }

    test('a deep chain of suites keeps every key the size of its own id', () => {
      const path = firstFailureRenderPath([chain(5_000, failing)])
      expect(path?.suites).toHaveLength(5_001)
      const longest = Math.max(...path!.suites.map((key) => key.length))
      expect(longest).toBeLessThan(32)
      expect(path?.suites.at(-1)).toBe(repeatedKey('ileaf', 0))
      expect(path?.test).toBe(repeatedKey('ibroken', 0))
    })

    test('a deep chain is searched in linear time', () => {
      const started = performance.now()
      firstFailureRenderPath([chain(20_000, failing)])
      expect(performance.now() - started).toBeLessThan(1_000)
    })

    test('duplicate ids at every depth are told apart by occurrence', () => {
      const duplicated: TestSuite = {
        id: 'dup',
        name: 'outer',
        suites: [
          { id: 'dup', name: 'first', tests: [{ id: 't', name: 'ok', status: 'passed' }] },
          {
            id: 'dup',
            name: 'second',
            tests: [
              { id: 't', name: 'a', status: 'passed' },
              { id: 't', name: 'b', status: 'failed' },
            ],
          },
        ],
      }
      expect(firstFailureRenderPath([duplicated, { ...duplicated }])).toEqual({
        suites: [repeatedKey('idup', 0), repeatedKey('idup', 1)],
        test: repeatedKey('it', 1),
      })
    })

    test('an id that looks like a position or contains a separator never collides', () => {
      const keys = [
        siblingKey({ id: 'p0' }, 0),
        siblingKey({}, 0),
        siblingKey({ id: '/a' }, 0),
        siblingKey({ id: 'a/' }, 0),
        siblingKey({ id: '' }, 0),
        siblingKey({ id: '"],0,["' }, 0),
      ]
      expect(new Set(keys).size).toBe(keys.length)
      const nested = firstFailureRenderPath([
        {
          id: 'a',
          name: 'a',
          suites: [{ id: 'b', name: 'b', tests: [{ name: 'x', status: 'failed' }] }],
        },
      ])
      const flat = firstFailureRenderPath([
        { id: 'a/b', name: 'a/b', tests: [{ name: 'x', status: 'failed' }] },
      ])
      expect(sameFailure(nested, flat)).toBe(false)
    })

    test('sameFailure compares the whole path, not just the test key', () => {
      const one = { suites: ['a', 'b'], test: 't' }
      expect(sameFailure(one, { suites: ['a', 'b'], test: 't' })).toBe(true)
      expect(sameFailure(one, { suites: ['a', 'c'], test: 't' })).toBe(false)
      expect(sameFailure(one, { suites: ['a'], test: 't' })).toBe(false)
      expect(sameFailure(one, undefined)).toBe(false)
      expect(sameFailure(undefined, undefined)).toBe(true)
    })
  })
})
