/**
 * The test run's pure rules: what the listed tests add up to, how that compares
 * with the counts the host reported, and how a duration is said.
 *
 * The one rule that shapes everything here is that a count is a claim. There are
 * two honest sources for one — the host's own tally (`summary`), and the tests it
 * chose to list — and they are allowed to disagree: a host may list only the
 * failures, a runner may count tests it did not stream, a suite may have been cut
 * short. So nothing is silently recomputed. A supplied count is shown as given; if
 * the tests listed do not add up to it, the listed number is shown beside it; and
 * when no summary was supplied, the counts that are shown are labelled as coming
 * from the tests listed, not presented as the run's totals.
 */

export type TestOutcome = 'passed' | 'failed' | 'skipped'
/** `running` and `pending` are states of a test that has no outcome yet; they are not counted. */
export type TestCaseStatus = TestOutcome | 'running' | 'pending'

export type TestCase = Readonly<{
  /** Stable identity for keyed rendering. Defaults to the position. */
  id?: string
  name: string
  /** Absent means the host did not say; the test is listed and nothing is claimed. */
  status?: TestCaseStatus
  durationMs?: number
  /** The failure message, as text. */
  message?: string
  /** A stack trace for `StackTrace` to read. */
  stack?: string
  /** A unified diff of expected against actual for `DiffBlock`. */
  diff?: string
}>

export type TestSuite = Readonly<{
  id?: string
  name: string
  /** The file the suite lives in, shown as text. */
  file?: string
  durationMs?: number
  tests?: readonly TestCase[]
  suites?: readonly TestSuite[]
}>

/** The host's own tally. Every field is optional; only supplied ones are shown. */
export type TestSummary = Readonly<{
  passed?: number
  failed?: number
  skipped?: number
  total?: number
  durationMs?: number
}>

export type ListedCounts = Readonly<{
  passed: number
  failed: number
  skipped: number
  running: number
  pending: number
  /** Tests listed with no status. */
  unknown: number
  /** Every test listed, whatever its status. */
  total: number
}>

const empty: ListedCounts = {
  passed: 0,
  failed: 0,
  skipped: 0,
  running: 0,
  pending: 0,
  unknown: 0,
  total: 0,
}

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  'passed',
  'failed',
  'skipped',
  'running',
  'pending',
])

/** Count the tests in a list of suites, at any depth. Iterative: suites come from a host. */
export function listedCounts(suites: readonly TestSuite[]): ListedCounts {
  const counts = { ...empty }
  const stack = [...suites]
  while (stack.length > 0) {
    const suite = stack.pop()!
    for (const test of suite.tests ?? []) {
      counts.total += 1
      // A status the host invented is as good as none.
      if (test.status !== undefined && KNOWN_STATUSES.has(test.status)) counts[test.status] += 1
      else counts.unknown += 1
    }
    for (const child of suite.suites ?? []) stack.push(child)
  }
  return counts
}

export type CountLine = Readonly<{
  outcome: TestOutcome
  /** The number to show: the host's if it gave one, otherwise the listed one. */
  count: number
  /** How many tests of this outcome are listed. */
  listed: number
  /** The host gave a count and the list does not agree with it. */
  differs: boolean
}>

export type RunCounts = Readonly<{
  /** Whose numbers these are. `listed` must be labelled as such. */
  basis: 'reported' | 'listed'
  lines: readonly CountLine[]
  /** The host's total, when supplied. */
  reportedTotal?: number
  /** The reported total, when the host gave one and the list disagrees. */
  totalNote?: Readonly<{ reported: number; listed: number }>
}>

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

const OUTCOMES: readonly TestOutcome[] = ['failed', 'passed', 'skipped']

/**
 * Decide which numbers to show.
 *
 * With a summary: exactly the counts it supplied, as given. `differs` is set
 * when tests are listed at all and the listed number for that outcome is not the
 * supplied one — a host that lists only failures will see "40 passed (0 listed)",
 * which is true and tells the reader the list is partial. Without a summary: the
 * outcomes that occur among the listed tests, with `basis: 'listed'`.
 */
export function reconcileCounts(summary: TestSummary | undefined, listed: ListedCounts): RunCounts {
  const supplied = OUTCOMES.filter((outcome) => validCount(summary?.[outcome]))
  const hasTotal = validCount(summary?.total)

  if (summary && (supplied.length > 0 || hasTotal)) {
    const lines: CountLine[] = supplied.map((outcome) => {
      const count = summary[outcome] as number
      return {
        outcome,
        count,
        listed: listed[outcome],
        differs: listed.total > 0 && listed[outcome] !== count,
      }
    })
    const totalNote =
      hasTotal && listed.total > 0 && summary.total !== listed.total
        ? { reported: summary.total as number, listed: listed.total }
        : undefined
    return {
      basis: 'reported',
      lines,
      ...(hasTotal && { reportedTotal: summary.total as number }),
      ...(totalNote && { totalNote }),
    }
  }

  const lines: CountLine[] = OUTCOMES.filter((outcome) => listed[outcome] > 0).map((outcome) => ({
    outcome,
    count: listed[outcome],
    listed: listed[outcome],
    differs: false,
  }))
  return { basis: 'listed', lines }
}

/** The words for one count: "38 passed", or "40 passed (38 listed)" when the list disagrees. */
export function describeCount(line: CountLine): string {
  const base = `${line.count.toLocaleString()} ${line.outcome}`
  return line.differs ? `${base} (${line.listed.toLocaleString()} listed)` : base
}

const plural = (n: number, one: string) => (n === 1 ? one : `${one}s`)

/**
 * A duration. `short` is for a meta column ("120 ms", "3.4 s"); `long` is for a
 * sentence ("120 milliseconds", "3.4 seconds", "2 minutes 5 seconds"). Anything
 * that is not a finite non-negative number has no duration, so none is drawn.
 */
export function formatDuration(ms: unknown, style: 'short' | 'long' = 'short'): string | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return undefined
  if (ms > 0 && ms < 1) return style === 'short' ? '<1 ms' : 'less than 1 millisecond'
  if (ms < 1000) {
    const whole = Math.round(ms)
    return style === 'short' ? `${whole} ms` : `${whole} ${plural(whole, 'millisecond')}`
  }
  if (ms < 60_000) {
    const seconds = ms < 10_000 ? Math.round(ms / 100) / 10 : Math.round(ms / 1000)
    const text = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
    return style === 'short' ? `${text} s` : `${text} ${seconds === 1 ? 'second' : 'seconds'}`
  }
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (style === 'short') return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`
  const m = `${minutes.toLocaleString()} ${plural(minutes, 'minute')}`
  return seconds === 0 ? m : `${m} ${seconds} ${plural(seconds, 'second')}`
}

export type SuiteState = 'failed' | 'passed' | 'running' | undefined

/**
 * What a suite can say about itself from the tests listed in it. Any listed
 * failure makes it `failed`; a listed test still running makes it `running`;
 * `passed` needs at least one passed test and every listed test to be passed or
 * skipped. Anything else — no tests, a test with no status — is silence.
 */
export function suiteState(counts: ListedCounts): SuiteState {
  if (counts.failed > 0) return 'failed'
  if (counts.running > 0) return 'running'
  if (counts.passed > 0 && counts.pending === 0 && counts.unknown === 0) return 'passed'
  return undefined
}

/** A suite's key among its siblings: its id if it has one, otherwise its position. */
export function suiteKey(parent: string, suite: TestSuite, index: number): string {
  return `${parent}/${suite.id ?? `s${index}`}`
}

export function testKey(parent: string, test: TestCase, index: number): string {
  return `${parent}:${test.id ?? `t${index}`}`
}

/** Distinguish repeated ids without tying a row to the object instance it renders. */
export function repeatedKey(key: string, occurrence: number): string {
  return JSON.stringify([key, occurrence])
}

export type BoundedEntry<T> = Readonly<{
  key: string
  item: T
  index: number
}>

/** Build keyed rows only for the currently visible prefix of a bounded list. */
export function boundedEntries<T>(
  items: readonly T[],
  visibleCount: number,
  itemKey: (item: T, index: number) => string
): Readonly<{
  entries: readonly BoundedEntry<T>[]
  byKey: ReadonlyMap<string, BoundedEntry<T>>
}> {
  const entries: BoundedEntry<T>[] = []
  const byKey = new Map<string, BoundedEntry<T>>()
  const occurrences = new Map<string, number>()
  const count = Math.max(0, Math.min(items.length, Math.floor(visibleCount)))

  for (let index = 0; index < count; index += 1) {
    const item = items[index]!
    const base = itemKey(item, index)
    const occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    const entry = { key: repeatedKey(base, occurrence), item, index }
    entries.push(entry)
    byKey.set(entry.key, entry)
  }

  return { entries, byKey }
}

/** The key of the first failing test in reading order, so exactly one failure opens by default. */
export function firstFailureKey(suites: readonly TestSuite[]): string | undefined {
  type Frame = { suites: readonly TestSuite[]; parent: string; index: number }
  const stack: Frame[] = [{ suites, parent: '', index: 0 }]
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    const suite = frame.suites[frame.index]
    if (!suite) {
      stack.pop()
      continue
    }
    frame.index += 1
    const key = suiteKey(frame.parent, suite, frame.index - 1)
    for (let i = 0; i < (suite.tests?.length ?? 0); i += 1) {
      if (suite.tests![i]!.status === 'failed') return testKey(key, suite.tests![i]!, i)
    }
    if (suite.suites?.length) stack.push({ suites: suite.suites, parent: key, index: 0 })
  }
  return undefined
}

/** The unique rendering key for the first failure, including repeated host ids. */
export function firstFailureRenderKey(suites: readonly TestSuite[]): string | undefined {
  type Frame = {
    suites: readonly TestSuite[]
    parent: string
    index: number
    occurrences: Map<string, number>
  }
  const stack: Frame[] = [{ suites, parent: '', index: 0, occurrences: new Map() }]
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    const suite = frame.suites[frame.index]
    if (!suite) {
      stack.pop()
      continue
    }
    frame.index += 1
    const baseKey = suiteKey(frame.parent, suite, frame.index - 1)
    const suiteOccurrence = frame.occurrences.get(baseKey) ?? 0
    frame.occurrences.set(baseKey, suiteOccurrence + 1)
    const key = repeatedKey(baseKey, suiteOccurrence)
    const tests = suite.tests ?? []
    const testOccurrences = new Map<string, number>()
    for (let i = 0; i < tests.length; i += 1) {
      const baseTestKey = testKey(key, tests[i]!, i)
      const testOccurrence = testOccurrences.get(baseTestKey) ?? 0
      testOccurrences.set(baseTestKey, testOccurrence + 1)
      if (tests[i]!.status === 'failed') return repeatedKey(baseTestKey, testOccurrence)
    }
    if (suite.suites?.length) {
      stack.push({ suites: suite.suites, parent: key, index: 0, occurrences: new Map() })
    }
  }
  return undefined
}
