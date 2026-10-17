import { FileDiff, FlaskConical, Terminal as TerminalIcon } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bubble } from '../../ui/bubble'
import { Message, MessageContent, MessageText } from '../../ui/message'
import { Trace, TraceLine } from '../../ui/trace'
import { FileTree } from '../file-tree'
import { TestResults } from '../test-results'
import { Terminal } from './terminal'

const ESC = '\u001b'
const sgr = (codes: string, text: string) => `${ESC}[${codes}m${text}${ESC}[0m`

/**
 * One coherent turn: the person asks for the tests to be run, and the agent
 * answers with what it did. Everything an agent produced sits in one quiet column
 * under the prose — the command and its output, the structured results with the
 * failure opened to its diff and stack, and the files it changed — as `Trace`
 * lines, not as three cards. The host passed no handlers, so nothing is
 * selectable or openable and no component claims more than it was told.
 */
const meta = {
  title: 'Composites/Results Scenario',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Results patterns in one assistant turn: the command the agent ran (Terminal), the structured test results with a failure opened to its message, diff and stack (TestResults, StackTrace), and the files it changed (FileTree). All inside a Message, as Trace lines.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[42rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const output = [
  `${sgr('1', 'bun test')} v1.4.2`,
  '',
  sgr('90', 'src/lib/keyed-rows.test.ts:'),
  `${sgr('32', '✓')} keeps rows across a refetch ${sgr('90', '[0.31ms]')}`,
  `${sgr('32', '✓')} drops a row when its key disappears ${sgr('90', '[0.12ms]')}`,
  `${sgr('31', '✗')} reuses the row when the key repeats ${sgr('90', '[1.04ms]')}`,
  `${sgr('31;1', 'error')}: expect(received).toBe(expected)`,
  '',
  sgr('2', 'Expected: 2'),
  sgr('2', 'Received: 3'),
  '',
  `    at ${sgr('4', 'src/lib/keyed-rows.test.ts:48:21')}`,
  '',
  `${sgr('32', ' 4 pass')}`,
  `${sgr('31', ' 1 fail')}`,
  ' 1 skip',
  'Ran 6 tests across 2 files. [3.40s]',
  '',
].join('\n')

const stack = `AssertionError: expected 3 to be 2
    at Object.<anonymous> (/repo/packages/ui/src/lib/keyed-rows.test.ts:48:21)
    at Promise.then.completed (/repo/node_modules/bun-test/dist/runner.js:210:28)
    at new Promise (<anonymous>)
    at callAsyncCircusFn (/repo/node_modules/bun-test/dist/runner.js:155:10)
    at run (/repo/packages/ui/src/lib/keyed-rows.ts:42:17)`

const diff = `--- expected
+++ received
@@ -1,3 +1,3 @@
 rows: [
-  "a", "b"
+  "a", "b", "b"
 ]`

const suites = [
  {
    name: 'keyed rows',
    file: 'src/lib/keyed-rows.test.ts',
    durationMs: 18,
    tests: [
      { name: 'keeps rows across a refetch', status: 'passed' as const, durationMs: 0.31 },
      { name: 'drops a row when its key disappears', status: 'passed' as const, durationMs: 0.12 },
      {
        name: 'reuses the row when the key repeats',
        status: 'failed' as const,
        durationMs: 1.04,
        message: 'expected 3 to be 2',
        diff,
        stack,
      },
      { name: 'handles an empty list', status: 'skipped' as const },
    ],
  },
  {
    name: 'terminal',
    file: 'src/components/composites/terminal/ansi.test.ts',
    durationMs: 420,
    tests: [
      { name: 'drops OSC 52 clipboard writes', status: 'passed' as const, durationMs: 4 },
      { name: 'reassembles a CSI split across chunks', status: 'passed' as const, durationMs: 2 },
    ],
  },
]

const changedFiles = [
  {
    path: 'packages/ui/src/lib/keyed-rows.ts',
    change: 'modified' as const,
    additions: 6,
    deletions: 2,
  },
  {
    path: 'packages/ui/src/lib/keyed-rows.test.ts',
    change: 'modified' as const,
    additions: 31,
    deletions: 0,
  },
  {
    path: 'packages/ui/src/components/composites/terminal/ansi.ts',
    change: 'added' as const,
    additions: 530,
    deletions: 0,
  },
  {
    path: 'packages/ui/src/components/composites/terminal/ansi.test.ts',
    change: 'added' as const,
    additions: 388,
    deletions: 0,
  },
  { path: 'packages/ui/src/lib/clip.ts', change: 'deleted' as const, additions: 0, deletions: 44 },
]

export const RanTheTests: Story = {
  render: () => (
    <div class="flex flex-col">
      <Message role="user" label="You">
        <Bubble>Run the tests for the keyed-rows change and tell me what fails.</Bubble>
      </Message>
      <Message role="assistant" label="Assistant">
        <MessageContent>
          <MessageText text="I ran the suite. One test fails and the rest pass. The output, the results and the files I changed are below." />
          <Trace aria-label="What I did">
            <TraceLine
              icon={<TerminalIcon />}
              title="Ran the tests"
              description="exit code 1"
              status="error"
              defaultOpen
            >
              <Terminal
                size="sm"
                command="bun test src/lib"
                output={output}
                status={{ state: 'exited', code: 1 }}
                maxHeight="10rem"
              />
            </TraceLine>
            <TraceLine
              icon={<FlaskConical />}
              title="Test results"
              description="1 failed"
              status="error"
              defaultOpen
            >
              <TestResults
                suites={suites}
                summary={{ passed: 4, failed: 1, skipped: 1, durationMs: 3400 }}
              />
            </TraceLine>
          </Trace>
          <MessageText
            text={
              'The failing test, `reuses the row when the key repeats`, gets a duplicate row back: `keyedRows` reuses the first entry for a repeated key but still pushes the item. I changed the mapping so a repeated key returns the existing row without adding another, and added the regression test.'
            }
          />
          <Trace aria-label="Changes">
            <TraceLine
              icon={<FileDiff />}
              title="Changed 5 files"
              description="+955 −46"
              defaultOpen
            >
              <FileTree files={changedFiles} showSummary={false} label="Files changed this turn" />
            </TraceLine>
          </Trace>
        </MessageContent>
      </Message>
    </div>
  ),
}
