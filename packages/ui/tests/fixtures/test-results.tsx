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
    </main>
  ),
  document.body
)
