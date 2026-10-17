import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  TestResults,
  type TestCase,
  type TestSuite,
  type TestSummary,
} from '../../src/components/composites/test-results'
import '../../src/styles/globals.css'

type FixtureWindow = Window & {
  replaceResults?: () => void
  showReportedTotal?: () => void
  reorderPagedResults?: () => void
  shrinkPagedResults?: () => void
  growPagedResults?: () => void
  reportStreamingFailure?: () => void
  updateStreamingFailure?: () => void
  lazyReads?: { diff: number; stack: number }
  updateLazyResults?: () => void
}

const initial: TestSuite[] = [
  {
    id: 'suite',
    name: 'Stable suite',
    tests: [{ id: 'test', name: 'Stable test', status: 'passed', message: 'Initial details' }],
  },
]

const [suites, setSuites] = createSignal(initial)
const [summary, setSummary] = createSignal<TestSummary>()

const pagedTest: Record<string, TestCase> = {
  first: { id: 'first', name: 'First row', status: 'passed' },
  second: { id: 'second', name: 'Second row', status: 'passed' },
  failure: {
    id: 'failure',
    name: 'Paged first failure',
    status: 'failed',
    message: 'Paged failure details',
  },
  fourth: { id: 'fourth', name: 'Fourth row', status: 'passed' },
  fifth: { id: 'fifth', name: 'Fifth row', status: 'passed' },
}
const pagedSuite = (order: readonly string[]): TestSuite[] => [
  {
    id: 'paged-suite',
    name: 'Paged suite',
    tests: order.map((id) => ({ ...pagedTest[id]! })),
  },
]
const [pagedSuites, setPagedSuites] = createSignal(
  pagedSuite(['first', 'second', 'failure', 'fourth', 'fifth'])
)

const deepChain = (depth: number): TestSuite => {
  let node: TestSuite = {
    id: 'same',
    name: 'Deepest suite',
    tests: [
      { id: 'broken', name: 'Deep failure', status: 'failed', message: 'Deep failure details' },
    ],
  }
  for (let level = depth; level > 0; level -= 1)
    node = { id: 'same', name: `Level ${level}`, suites: [node] }
  return node
}

export const bigMessage = Array.from(
  { length: 3_000 },
  (_, i) => `captured log line ${i + 1}`
).join('\n')
;(window as FixtureWindow & { bigMessage?: string }).bigMessage = bigMessage

const streamingSuite = (status: 'running' | 'failed', message?: string): TestSuite[] => [
  {
    id: 'streaming-suite',
    name: 'Streaming suite',
    tests: [
      {
        id: 'streamed-failure',
        name: 'Streamed failure',
        status,
        ...(message ? { message } : {}),
      },
    ],
  },
]
const [streamingSuites, setStreamingSuites] = createSignal(streamingSuite('running'))

// A suite that opens itself (its first test failed) with a second, collapsed test whose
// diff and stack count every read, so a body built for a closed test shows as reads
// and not only as nodes in the page.
const lazyReads = { diff: 0, stack: 0 }
;(window as FixtureWindow).lazyReads = lazyReads
const lazyDiff = '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-expected\n+received\n'
const lazySuite = (revision: number): TestSuite[] => [
  {
    id: 'lazy-suite',
    name: 'Lazy suite',
    tests: [
      { id: 'open-failure', name: 'Open failure', status: 'failed', message: 'Opens itself' },
      {
        id: 'hidden',
        name: `Hidden diff r${revision}`,
        status: 'failed',
        get diff() {
          lazyReads.diff += 1
          return lazyDiff
        },
        get stack() {
          lazyReads.stack += 1
          return 'Error: hidden\n    at hidden (/app/src/hidden.ts:1:1)'
        },
      },
    ],
  },
]
const [lazySuites, setLazySuites] = createSignal(lazySuite(1))
;(window as FixtureWindow).updateLazyResults = () => {
  // Returns nothing: a returned suite would be serialised by the test driver, reading every getter.
  setLazySuites(lazySuite(2))
}

;(window as FixtureWindow).replaceResults = () => {
  setSuites([
    {
      id: 'suite',
      name: 'Stable suite',
      tests: [{ id: 'test', name: 'Stable test', status: 'passed', message: 'Updated details' }],
    },
  ])
}
;(window as FixtureWindow).showReportedTotal = () => {
  setSuites([])
  setSummary({ total: 10 })
}
;(window as FixtureWindow).reorderPagedResults = () => {
  setPagedSuites(pagedSuite(['fourth', 'failure', 'first', 'second', 'fifth']))
}
;(window as FixtureWindow).shrinkPagedResults = () => {
  setPagedSuites(pagedSuite(['fourth', 'failure', 'first']))
}
;(window as FixtureWindow).growPagedResults = () => {
  setPagedSuites(pagedSuite(['fifth', 'failure', 'fourth', 'first', 'second']))
}
;(window as FixtureWindow).reportStreamingFailure = () => {
  setStreamingSuites(streamingSuite('failed', 'Initial streamed failure'))
}
;(window as FixtureWindow).updateStreamingFailure = () => {
  setStreamingSuites(streamingSuite('failed', 'Updated streamed failure'))
}

render(
  () => (
    <main class="w-2xl max-w-full p-4">
      <TestResults suites={suites()} summary={summary()} />
      <TestResults label="Paged test results" suites={pagedSuites()} listLimit={2} />
      <TestResults label="Streaming test results" suites={streamingSuites()} running />
      <TestResults label="Lazy detail test results" suites={lazySuites()} />
      <TestResults label="Deeply nested test results" suites={[deepChain(40)]} />
      <TestResults
        label="Large failure test results"
        suites={[
          {
            id: 'large',
            name: 'Large failure suite',
            tests: [
              { id: 'noisy', name: 'Noisy failure', status: 'failed', message: bigMessage },
              { id: 'quiet', name: 'Quiet failure', status: 'failed', message: 'Short failure' },
            ],
          },
        ]}
      />
    </main>
  ),
  document.body
)
