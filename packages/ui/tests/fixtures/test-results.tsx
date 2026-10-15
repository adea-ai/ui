import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  TestResults,
  type TestSuite,
  type TestSummary,
} from '../../src/components/composites/test-results'
import '../../src/styles/globals.css'

type FixtureWindow = Window & {
  replaceResults?: () => void
  showReportedTotal?: () => void
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

render(
  () => (
    <main class="w-2xl max-w-full p-4">
      <TestResults suites={suites()} summary={summary()} />
    </main>
  ),
  document.body
)
