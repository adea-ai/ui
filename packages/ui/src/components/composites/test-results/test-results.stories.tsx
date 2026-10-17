import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Trace, TraceLine } from '../../ui/trace'
import { TestResults } from './test-results'
import type { TestSuite } from './test-results-model'

const meta = {
  title: 'Composites/Test Results',
  component: TestResults,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A test run: counts in words with a segmented bar that does not rely on colour, suites as collapsible Trace lines, and failing tests opening onto their message, diff and stack. Counts are claims: the host's tally is shown as given, a disagreement with the tests listed is noted rather than recomputed, and without a tally the counts are labelled as coming from the tests listed.",
      },
    },
  },
  args: { suites: [] },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[40rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TestResults>

export default meta
type Story = StoryObj<typeof meta>

const failingStack = `AssertionError: expected 3 to be 2
    at Object.<anonymous> (/repo/src/lib/keyed-rows.test.ts:48:21)
    at Promise.then.completed (/repo/node_modules/bun-test/dist/runner.js:210:28)
    at new Promise (<anonymous>)
    at callAsyncCircusFn (/repo/node_modules/bun-test/dist/runner.js:155:10)
    at run (/repo/src/lib/keyed-rows.test.ts:40:3)`

const diff = `--- expected
+++ received
@@ -1,3 +1,3 @@
 rows: [
-  "a", "b"
+  "a", "b", "b"
 ]`

const suites: TestSuite[] = [
  {
    name: 'keyed rows',
    file: 'src/lib/keyed-rows.test.ts',
    durationMs: 18,
    tests: [
      { name: 'keeps rows across a refetch', status: 'passed', durationMs: 0.31 },
      { name: 'drops a row when its key disappears', status: 'passed', durationMs: 0.12 },
      {
        name: 'reuses the row when the key repeats',
        status: 'failed',
        durationMs: 1.04,
        message: 'expected 3 to be 2',
        diff,
        stack: failingStack,
      },
      { name: 'handles an empty list', status: 'skipped' },
    ],
  },
  {
    name: 'terminal',
    file: 'src/components/composites/terminal/ansi.test.ts',
    durationMs: 420,
    tests: [
      { name: 'drops OSC 52 clipboard writes', status: 'passed', durationMs: 4 },
      { name: 'reassembles a CSI split across chunks', status: 'passed', durationMs: 2 },
    ],
  },
]

/**
 * A run with a failure. The failing suite and its first failing test are open;
 * the message, diff and stack are text. The passing suite is closed and its tests
 * are not rendered until it is opened.
 */
export const WithFailure: Story = {
  args: {
    suites,
    summary: { passed: 4, failed: 1, skipped: 1, durationMs: 3400 },
  },
}

/**
 * The host reported 40 passed and 2 failed but listed only the tests it chose to
 * stream. The counts are shown as given; the listed number is noted beside any
 * that disagree, so a partial list reads as partial.
 */
export const SummaryDisagreesWithList: Story = {
  args: {
    suites,
    summary: { passed: 40, failed: 2, skipped: 1, total: 43, durationMs: 12_400 },
  },
}

/**
 * No summary from the host: the counts are those of the tests listed, and the
 * component says so instead of presenting them as the run's totals.
 */
export const NoSummary: Story = { args: { suites } }

/** Tests with no status at all: they are listed, nothing is counted, and no suite claims a result. */
export const StatusAbsent: Story = {
  args: {
    suites: [
      {
        name: 'imports',
        tests: [{ name: 'resolves the barrel' }, { name: 'tree-shakes the registry' }],
      },
    ],
  },
}

/** Only counts: the host has a tally and no tests to list. */
export const SummaryOnly: Story = {
  args: { suites: [], summary: { passed: 1280, failed: 0, skipped: 12, durationMs: 41_000 } },
}

/** One failure in five thousand is still a sliver on the bar, and still the first thing the words say. */
export const OneFailureInThousands: Story = {
  args: { suites: [], summary: { passed: 4999, failed: 1, durationMs: 192_000 } },
}

export const Running: Story = {
  args: {
    running: true,
    summary: { passed: 2 },
    suites: [
      {
        name: 'integration',
        tests: [
          { name: 'boots the server', status: 'passed' },
          { name: 'migrates the database', status: 'passed' },
          { name: 'serves the settings navigation', status: 'running' },
          { name: 'tears down', status: 'pending' },
        ],
      },
    ],
  },
}

export const Empty: Story = { args: { suites: [] } }

const manyTests: TestSuite[] = Array.from({ length: 12 }, (_unused, s) => ({
  id: `suite-${s}`,
  name: `generated suite ${s + 1}`,
  file: `tests/generated/suite-${s + 1}.test.ts`,
  tests: Array.from({ length: 400 }, (_, t) => ({
    name: `case ${t + 1}`,
    status: (t === 399 && s === 11 ? 'failed' : 'passed') as 'failed' | 'passed',
    durationMs: t % 17,
    ...(t === 399 && s === 11 && { message: 'timed out after 5000 ms', stack: failingStack }),
  })),
}))

/**
 * 4 800 tests across 12 suites. Suites and tests are listed 50 at a time with a
 * count of what is hidden; the suite with the failure is open, but the test stays
 * unmounted behind "show more" until its page is revealed.
 */
export const LongRun: Story = {
  args: { suites: manyTests, summary: { passed: 4799, failed: 1, durationMs: 88_000 } },
}

/** An unknown stack format is shown whole, not parsed and not hidden. */
export const FailureWithUnknownStack: Story = {
  args: {
    suites: [
      {
        name: 'go bridge',
        tests: [
          {
            name: 'panics on an empty slice',
            status: 'failed',
            stack:
              'panic: runtime error: index out of range [0] with length 0\n\ngoroutine 6 [running]:\nmain.TestEmpty(0xc0000a4000)\n\t/app/bridge_test.go:12 +0x1d',
          },
        ],
      },
    ],
    summary: { failed: 1 },
  },
}

/** In the body of the Trace line for the command that ran the tests. */
export const InsideTrace: Story = {
  render: () => {
    const [open, setOpen] = createSignal(true)
    return (
      <Trace aria-label="Activity">
        <TraceLine
          title="Ran bun test"
          description="1 failed"
          status="error"
          open={open()}
          onOpenChange={setOpen}
        >
          <TestResults
            suites={suites}
            summary={{ passed: 4, failed: 1, skipped: 1, durationMs: 3400 }}
          />
        </TraceLine>
      </Trace>
    )
  },
}
