import {
  Ban,
  Bug,
  CircleAlert,
  FileDiff,
  FilePen,
  FileText,
  FlaskConical,
  Globe,
  RotateCw,
  Search,
  Square,
  Terminal as TerminalIcon,
} from 'lucide-solid'
import { createSignal, For, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import type { BusySendMode } from '../../conversation/busy-send-button'
import { ChatComposer } from '../../conversation/chat-composer'
import { ComposerAttachmentButton } from '../../conversation/message-composer'
import { Attachment, AttachmentList } from '../../ui/attachment'
import { Bubble } from '../../ui/bubble'
import { Button } from '../../ui/button'
import { CodeBlock } from '../../ui/code-block'
import { Marker } from '../../ui/marker'
import { Message, MessageContent, MessageText } from '../../ui/message'
import { Questionnaire, type QuestionnaireStatus } from '../../ui/questionnaire'
import { StatusChip } from '../../ui/status-chip'
import { Trace, TraceLine } from '../../ui/trace'
import { Checkpoint } from '../checkpoint'
import { Confirmation, type ConfirmationState } from '../confirmation'
import { Context } from '../context'
import { FileTree } from '../file-tree'
import { InlineCitation } from '../inline-citation'
import { MessageScroller } from '../message-scroller'
import { ModelSelector, type ModelOption } from '../model-selector'
import { QueueFollowUps } from '../queue'
import { Reasoning } from '../reasoning'
import { Sources, type Source } from '../sources'
import { StackTrace } from '../stack-trace'
import { Subagent } from '../subagent'
import { Suggestion, Suggestions } from '../suggestion'
import { Terminal } from '../terminal'
import { TestResults } from '../test-results'
import { Tool } from '../tool'
import { Chat, ChatEmpty, ChatHeader, ChatNotice } from './chat'

/**
 * Six whole conversations, each one a single coherent scene rather than a
 * catalogue: a run in flight, a run waiting on the reader, a finished run, a
 * dropped connection, a failed and a cancelled run, and a conversation that has
 * not started.
 *
 * Which component fills which role:
 *
 * - `Chat` is the frame; `ChatHeader` names the conversation and says its state
 *   in words; `ChatNotice` is for what is true of the whole conversation.
 * - `MessageScroller` is the thread; `Message` + `Bubble` are the turns.
 * - Everything the agent did is `Trace` lines under the answer: `Reasoning`,
 *   `Tool`, `Subagent`, `Terminal`, `TestResults`, `StackTrace`, `FileTree`.
 * - What the reader must act on is the only thing with a surface:
 *   `Questionnaire` and `Confirmation`.
 * - `Sources` and `InlineCitation` ground the prose; `Checkpoint` and `Marker`
 *   record events between and inside turns.
 * - The composer is `ChatComposer` with its slots: `Suggestions` (`followUps`),
 *   `QueueFollowUps` (`band`), `Attachment` (`attachments`), `ModelSelector`
 *   and `Context` (`context`), and a Stop button (`trailingActions`).
 *
 * Every status, citation and checkpoint below is data the story supplies. The
 * reasoning is a summary the host marked as visible; nothing implies hidden text.
 */
const meta = {
  title: 'Composites/Chat Scenario',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Full conversations assembled from the library: Chat, MessageScroller, the Trace patterns, Questionnaire and Confirmation, grounding, results and the composer with its slots. Each story is one realistic scene.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="h-192 w-full max-w-160 overflow-hidden rounded-lg border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const ESC = '\u001b'
const sgr = (codes: string, text: string) => `${ESC}[${codes}m${text}${ESC}[0m`
const FENCE = '```'

const MODELS: ModelOption[] = [
  {
    id: 'sonnet',
    label: 'Sonnet',
    provider: 'Anthropic',
    description: 'Balanced for everyday work',
    efforts: ['low', 'medium', 'high'],
  },
  { id: 'haiku', label: 'Haiku', provider: 'Anthropic', description: 'Fast and light' },
  {
    id: 'opus',
    label: 'Opus',
    provider: 'Anthropic',
    disabledReason: 'Not included in your plan.',
    efforts: ['low', 'medium', 'high'],
  },
]

type ComposerProps = {
  initialDraft?: string
  placeholder?: string
  /** Why Send is unavailable, in words. Leaves the field itself editable. */
  blockedReason?: string
  /** The run is going: Send becomes Steer/Queue and a Stop button appears. */
  running?: boolean
  suggestions?: readonly string[]
  /** Why the prompt chips cannot be used right now. */
  suggestionsDisabledReason?: string
  queued?: readonly string[]
  attachment?: boolean
  /** Why the model cannot be changed right now. */
  modelDisabledReason?: string
}

/**
 * The composer for every scene: `ChatComposer` with the slots this scene needs.
 * The shell supplies a slot for each role (follow-ups, band, staged content,
 * leading/trailing actions, context), so nothing here wraps or restyles it.
 */
function Composer(props: ComposerProps) {
  const [draft, setDraft] = createSignal(props.initialDraft ?? '')
  const [mode, setMode] = createSignal<BusySendMode>('steer')
  const [queued, setQueued] = createSignal<readonly string[]>(props.queued ?? [])
  const [attached, setAttached] = createSignal(props.attachment === true)
  const [model, setModel] = createSignal('sonnet')
  const [effort, setEffort] = createSignal<string | undefined>('medium')

  return (
    <ChatComposer
      value={draft()}
      onValueChange={setDraft}
      placeholder={props.placeholder}
      blockedReason={props.blockedReason}
      onSubmit={({ text, action }) => {
        if (action === 'queue') setQueued((current) => [...current, text])
        setDraft('')
      }}
      busy={props.running ? { mode: mode(), onModeChange: setMode } : undefined}
      followUps={
        <Show when={props.suggestions?.length}>
          <Suggestions
            label="Follow-up prompts"
            layout="scroll"
            onSelect={setDraft}
            disabledReason={props.suggestionsDisabledReason}
          >
            <For each={props.suggestions}>{(text) => <Suggestion text={text} />}</For>
          </Suggestions>
        </Show>
      }
      band={
        <QueueFollowUps
          items={queued().map((text, index) => ({
            id: `queued-${index}`,
            text,
            onRemove: () => setQueued((current) => current.filter((_, i) => i !== index)),
          }))}
        />
      }
      attachments={
        <Show when={attached()}>
          <AttachmentList aria-label="1 attachment" class="px-3 pt-3">
            <li>
              <Attachment
                name="users-schema.sql"
                kind="code"
                size={2300}
                onRemove={() => setAttached(false)}
              />
            </li>
          </AttachmentList>
        </Show>
      }
      leadingActions={<ComposerAttachmentButton count={attached() ? 1 : undefined} />}
      trailingActions={
        <Show when={props.running}>
          <Button type="button" variant="outline" size="sm">
            <Square />
            Stop
          </Button>
        </Show>
      }
      context={
        <>
          <ModelSelector
            models={MODELS}
            value={model()}
            effort={effort()}
            onChange={setModel}
            onEffortChange={setEffort}
            disabledReason={props.modelDisabledReason}
          />
          <Context
            class="ms-auto"
            used={118_400}
            total={200_000}
            breakdown={{ input: 96_200, output: 14_800, cacheRead: 7_400 }}
            cost={{ amount: 0.37, currency: 'USD' }}
          />
        </>
      }
    />
  )
}

const docSources: Source[] = [
  {
    id: 'guide',
    title: 'Default locale: i18n guide',
    url: 'https://example.com/docs/i18n/default-locale',
    snippet:
      'Take the initial locale from the browser language list. Do not hard-code a region for users who have not chosen one.',
  },
  {
    id: 'alter',
    title: 'Adding a column without a table rewrite',
    url: 'https://example.com/docs/postgres/add-column',
    snippet:
      'A nullable column with no default is a catalog change only. Backfill existing rows in batches afterwards.',
  },
]

/** An assistant turn in progress: reasoning, a subagent, grounded prose, and a tail still arriving. */
function WorkingTurn() {
  return (
    <Message role="assistant" label="Assistant" streaming anchorId="working-reply">
      <MessageContent>
        <Trace aria-label="Activity">
          <Reasoning
            duration={5}
            text={
              'The `users` table is large, so the column has to be added as nullable and backfilled separately; a default would rewrite the whole table.\n\nThe default value is a product rule, not a database one, so I will check what the i18n guide says before writing the migration.'
            }
          />
          <Tool
            name="read_file"
            icon={<FileText />}
            description="db/migrations/0053_users.sql"
            status="success"
            input={{ path: 'db/migrations/0053_users.sql' }}
            output={'CREATE TABLE users (\n  id bigint PRIMARY KEY,\n  email text NOT NULL\n);'}
          />
          <Subagent
            name="Docs check"
            task="Look up the default locale"
            status="success"
            model="haiku-4"
            duration={14}
            result={
              <MessageText text="The guide recommends the browser language list as the source, and says to leave the stored value empty until the person chooses one." />
            }
          >
            <Tool
              name="search_docs"
              icon={<Search />}
              description="default locale"
              status="success"
            />
            <Tool
              name="fetch_page"
              icon={<Globe />}
              description="example.com/docs/i18n/default-locale"
              status="success"
            />
          </Subagent>
          <Tool
            name="write_file"
            icon={<FilePen />}
            description="db/migrations/0054_add_locale.sql"
            status="running"
            input={{ path: 'db/migrations/0054_add_locale.sql' }}
          />
        </Trace>
        <p class="m-0 [overflow-wrap:anywhere]">
          The guide takes the default from the browser's language list rather than a fixed value
          <InlineCitation index={1} sources={[docSources[0]!]} />, and the column should be added as
          nullable so the table is not rewritten
          <InlineCitation index={2} sources={[docSources[1]!]} />.
        </p>
        <Sources sources={docSources} />
        <MessageText
          streaming
          text="I am writing `0054_add_locale.sql` now. The backfill will run in batches of 5,000 rows so"
        />
      </MessageContent>
    </Message>
  )
}

/**
 * The run is going. The composer's Send has become Steer/Queue because the host
 * said it is busy, a Stop button sits beside it, one follow-up is already
 * queued, and a file is staged. The running tool is the only spinner.
 */
export const Working: Story = {
  render: () => (
    <Chat
      header={
        <ChatHeader
          title="Add a locale column"
          subtitle="adea-ai/ui · feature/user-locale"
          status={<StatusChip tone="pending" label="Working" />}
        />
      }
      composer={
        <Composer
          running
          attachment
          initialDraft="Also add an index on locale"
          placeholder="Steer the run or queue a follow-up…"
          suggestions={['Show me the migration so far', 'Run the tests when it is done']}
          queued={['After that, update the seed data']}
        />
      }
    >
      <MessageScroller gutter announcement="Assistant is responding">
        <Message role="user" label="You" anchorId="working-ask">
          <Bubble>
            Add a locale column to users and default it from the browser language. Check what our
            i18n guide recommends for the default first.
          </Bubble>
        </Message>
        <WorkingTurn />
      </MessageScroller>
    </Chat>
  ),
}

const migrationCommand = {
  kind: 'code' as const,
  language: 'sh',
  title: 'bash',
  code: 'bun run --cwd packages/db db:migrate --env staging --only 0054_add_locale',
}

function ApprovalScene() {
  const [questions, setQuestions] = createSignal<QuestionnaireStatus>('open')
  const [approval, setApproval] = createSignal<ConfirmationState>('requested')
  const reason = () => {
    if (questions() === 'open' && approval() === 'requested')
      return 'Answer the question and approve or deny the command to continue.'
    if (questions() === 'open') return 'Answer the question to continue.'
    if (approval() === 'requested') return 'Approve or deny the command to continue.'
    return undefined
  }

  return (
    <Chat
      header={
        <ChatHeader
          title="Apply the locale migration"
          subtitle="adea-ai/ui · staging"
          status={
            <StatusChip
              tone={reason() ? 'warning' : 'success'}
              label={reason() ? 'Waiting for you' : 'Answered'}
            />
          }
        />
      }
      composer={<Composer blockedReason={reason()} placeholder="Write a message…" />}
    >
      <MessageScroller gutter announcement={reason() ? 'Assistant is waiting for your answer' : ''}>
        <Message role="user" label="You" anchorId="approval-ask">
          <Bubble>
            Apply the new locale migration to staging and tell me how many rows get a value.
          </Bubble>
        </Message>
        <Message role="assistant" label="Assistant" anchorId="approval-reply">
          <MessageContent>
            <Trace aria-label="Activity">
              <Tool
                name="read_file"
                icon={<FileText />}
                description="db/migrations/0054_add_locale.sql"
                status="success"
                input={{ path: 'db/migrations/0054_add_locale.sql' }}
              />
              <Tool
                name="run_command"
                icon={<TerminalIcon />}
                description="bun run db:status --env staging"
                status="success"
                output="1 pending: 0054_add_locale.sql"
              />
            </Trace>
            <MessageText text="Migration 0054 is the only one pending on staging. I need one choice from you, and your approval, before I run it." />
            <Questionnaire
              title="Backfill settings"
              status={questions()}
              onSubmit={async () => {
                await pause(500)
                setQuestions('answered')
              }}
              questions={[
                {
                  id: 'batch',
                  prompt: 'How many rows should each backfill batch update?',
                  description: 'Smaller batches hold row locks for less time but take longer.',
                  options: [
                    { id: '1000', label: '1,000 rows', description: 'Gentlest on staging traffic' },
                    { id: '5000', label: '5,000 rows', description: 'Fewer round trips' },
                  ],
                },
                {
                  id: 'skip',
                  prompt: 'Is there anything the backfill should skip?',
                  textPlaceholder: 'For example, service accounts',
                  optional: true,
                },
              ]}
            />
            <Confirmation
              state={approval()}
              title="Run migration 0054 on staging?"
              description="It adds the nullable locale column. Nothing runs until you answer."
              details={migrationCommand}
              onApprove={async () => {
                await pause(700)
                setApproval('approved')
              }}
              onDeny={async () => {
                await pause(400)
                setApproval('denied')
              }}
              resolvedBy="You"
            />
          </MessageContent>
        </Message>
      </MessageScroller>
    </Chat>
  )
}

/**
 * The run has stopped and is waiting on the reader. The two things that need an
 * answer are the only surfaces in the column; the composer's field stays
 * editable but Send is off, with the reason in words, and it clears as each
 * request is answered.
 */
export const WaitingForApproval: Story = { render: () => <ApprovalScene /> }

const testOutput = [
  `${sgr('1', 'bun test')} v1.4.2`,
  '',
  sgr('90', 'src/lib/keyed-rows.test.ts:'),
  `${sgr('32', '✓')} keeps rows across a refetch ${sgr('90', '[0.31ms]')}`,
  `${sgr('32', '✓')} drops a row when its key disappears ${sgr('90', '[0.12ms]')}`,
  `${sgr('31', '✗')} reuses the row when the key repeats ${sgr('90', '[1.04ms]')}`,
  `${sgr('31;1', 'error')}: expect(received).toEqual(expected)`,
  '',
  sgr('2', 'Expected: ["a", "b"]'),
  sgr('2', 'Received: ["a", "b", "b"]'),
  '',
  ` ${sgr('32', '4 pass')}`,
  ` ${sgr('31', '1 fail')}`,
  'Ran 5 tests across 1 file. [1.80s]',
  '',
].join('\n')

const failureDiff = `--- expected
+++ received
@@ -1,4 +1,5 @@
 [
   "a",
   "b",
+  "b",
 ]`

const failureStack = `AssertionError: expected [ 'a', 'b', 'b' ] to equal [ 'a', 'b' ]
    at Object.<anonymous> (/repo/packages/ui/src/lib/keyed-rows.test.ts:48:21)
    at run (/repo/packages/ui/src/lib/keyed-rows.ts:42:17)
    at callAsyncCircusFn (/repo/node_modules/bun-test/dist/runner.js:155:10)`

const changedFiles = [
  {
    path: 'packages/ui/src/lib/keyed-rows.ts',
    change: 'modified' as const,
    additions: 3,
    deletions: 1,
  },
  {
    path: 'packages/ui/src/lib/keyed-rows.test.ts',
    change: 'modified' as const,
    additions: 9,
    deletions: 0,
  },
]

const answerIntro = [
  'One test fails: `reuses the row when the key repeats`. `keyedRows` finds the existing row for a repeated key but still pushes the item, so the list gains a duplicate.',
  '',
  'I changed the mapping so a repeated key reuses the row without adding another:',
].join('\n')

/** The change itself: the gutter carries +/- through `lineMarks`, so the source stays copyable. */
const answerDiff = [
  '// keyedRows',
  'const existing = byKey.get(key)',
  'rows.push(existing ?? create(item))',
  'if (existing) continue',
  'rows.push(create(item))',
].join('\n')

const answerOutro = [
  'And added a regression test beside the others:',
  '',
  `${FENCE}ts`,
  "test('reuses the row when the key repeats', () => {",
  "  const rows = keyedRows(['a', 'b', 'b'], (key) => ({ key }))",
  "  expect(rows.map((row) => row.key)).toEqual(['a', 'b'])",
  '})',
  FENCE,
  '',
  'I have not re-run the suite since the edit. Run `bun test src/lib` to confirm.',
].join('\n')

/**
 * The run is over. The turn keeps what the agent produced as `Trace` lines: the
 * command and its output, the structured results with the failure opened to its
 * message and diff, the stack, and the files it changed. The checkpoint is
 * restorable only because the story gave it `onRestore`.
 */
export const Finished: Story = {
  render: () => (
    <Chat
      header={
        <ChatHeader
          title="Fix the keyed-rows duplicate"
          subtitle="adea-ai/ui · fix/keyed-rows"
          status={<StatusChip tone="success" label="Finished" />}
        />
      }
      composer={
        <Composer
          placeholder="Ask a follow-up…"
          suggestions={['Re-run the tests', 'Open a pull request']}
        />
      }
    >
      <MessageScroller gutter>
        <Message role="user" label="You" anchorId="finished-ask">
          <Bubble>Run the tests for the keyed-rows change, tell me what fails, and fix it.</Bubble>
        </Message>
        <Checkpoint
          label="Before the fix"
          time="14:02"
          consequence="Returns the working tree to this point and drops the 2 files edited since. The conversation itself is kept."
          onRestore={() => new Promise<void>((resolve) => setTimeout(resolve, 800))}
        />
        <Message role="assistant" label="Assistant" anchorId="finished-reply">
          <MessageContent>
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
                  output={testOutput}
                  status={{ state: 'exited', code: 1 }}
                  maxHeight="9rem"
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
                  suites={[
                    {
                      name: 'keyed rows',
                      file: 'src/lib/keyed-rows.test.ts',
                      durationMs: 18,
                      tests: [
                        { name: 'keeps rows across a refetch', status: 'passed', durationMs: 0.31 },
                        {
                          name: 'drops a row when its key disappears',
                          status: 'passed',
                          durationMs: 0.12,
                        },
                        {
                          name: 'reuses the row when the key repeats',
                          status: 'failed',
                          durationMs: 1.04,
                          message: "expected [ 'a', 'b', 'b' ] to equal [ 'a', 'b' ]",
                          diff: failureDiff,
                        },
                        { name: 'handles an empty list', status: 'skipped' },
                      ],
                    },
                  ]}
                  summary={{ passed: 2, failed: 1, skipped: 1, durationMs: 1800 }}
                />
              </TraceLine>
              <TraceLine
                icon={<Bug />}
                title="Stack trace"
                description="reuses the row when the key repeats"
              >
                <StackTrace text={failureStack} />
              </TraceLine>
              <TraceLine
                icon={<FileDiff />}
                title="Changed 2 files"
                description="+12 −1"
                defaultOpen
              >
                <FileTree
                  files={changedFiles}
                  showSummary={false}
                  label="Files changed this turn"
                />
              </TraceLine>
            </Trace>
            <MessageText text={answerIntro} />
            <CodeBlock
              code={answerDiff}
              complete
              language="ts"
              title="keyed-rows.ts"
              lineMarks={{ 3: 'remove', 4: 'add', 5: 'add' }}
            />
            <MessageText text={answerOutro} />
          </MessageContent>
        </Message>
      </MessageScroller>
    </Chat>
  ),
}

/**
 * The connection dropped. The notice is about the whole conversation, so it sits
 * above the thread and is announced; the last turn stays readable. The field is
 * still editable and the draft is kept, but Send is off with the reason, and so
 * are the model picker and the prompt chips.
 */
export const Reconnecting: Story = {
  render: () => {
    const [retrying, setRetrying] = createSignal(false)
    return (
      <Chat
        header={
          <ChatHeader
            title="Release process"
            subtitle="adea-ai/ui · main"
            status={<StatusChip tone="warning" label="Offline" />}
          />
        }
        notices={
          <ChatNotice
            tone="warning"
            live="polite"
            title="Reconnecting…"
            description={
              retrying()
                ? 'Trying again now.'
                : 'The connection dropped. Your message is kept and can be sent once it is back.'
            }
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={retrying()}
                onClick={() => setRetrying(true)}
              >
                <RotateCw />
                {retrying() ? 'Retrying…' : 'Retry now'}
              </Button>
            }
          />
        }
        composer={
          <Composer
            initialDraft="Thanks. Can you also check the changelog format?"
            blockedReason="Offline. Send is unavailable until the connection is back."
            modelDisabledReason="Reconnect to change the model."
            suggestions={['Show the changelog']}
            suggestionsDisabledReason="Prompts are unavailable while offline."
          />
        }
      >
        <MessageScroller gutter>
          <Message role="user" label="You" anchorId="reconnect-ask">
            <Bubble>Which branch is the release cut from?</Bubble>
          </Message>
          <Message role="assistant" label="Assistant" anchorId="reconnect-reply">
            <MessageContent>
              <Trace aria-label="Activity">
                <Tool
                  name="read_file"
                  icon={<FileText />}
                  description="release-please-config.json"
                  status="success"
                  input={{ path: 'release-please-config.json' }}
                />
              </Trace>
              <MessageText text="The release is cut from `main`. Release Please opens a pull request with the changelog, and merging it tags the version." />
            </MessageContent>
          </Message>
        </MessageScroller>
      </Chat>
    )
  },
}

/** The request behind both the failed and the cancelled scene. */
const RUN_ASK = 'Run the db package tests and tell me if the new migration breaks anything.'

/**
 * The run failed. The turn keeps what happened before the failure, the failed
 * tool shows its error as text, and a note records the failure with a Retry the
 * host handles. Nothing is spinning and the composer is ready again.
 */
export const Failed: Story = {
  render: () => (
    <Chat
      header={
        <ChatHeader
          title="Check the migration"
          subtitle="adea-ai/ui · feature/user-locale"
          status={<StatusChip tone="danger" label="Failed" />}
        />
      }
      composer={<Composer placeholder="Write a message…" />}
    >
      <MessageScroller gutter>
        <Message role="user" label="You" anchorId="failed-ask">
          <Bubble>{RUN_ASK}</Bubble>
        </Message>
        <Message role="assistant" label="Assistant" anchorId="failed-reply">
          <MessageContent>
            <Trace aria-label="Activity">
              <Reasoning
                duration={3}
                text="The migration only adds a nullable column, so the db package tests are the right check."
              />
              <Tool
                name="read_file"
                icon={<FileText />}
                description="db/migrations/0054_add_locale.sql"
                status="success"
                input={{ path: 'db/migrations/0054_add_locale.sql' }}
              />
              <Tool
                name="run_command"
                icon={<TerminalIcon />}
                description="bun test packages/db"
                status="error"
                defaultOpen
                input={{ command: 'bun test packages/db' }}
                errorText="The command timed out after 120 seconds."
              />
            </Trace>
            <Marker
              variant="note"
              tone="danger"
              live="polite"
              icon={<CircleAlert />}
              label="This run failed"
              description="The model provider returned 429 (rate limited) after 3 retries."
              action={
                <Button type="button" variant="outline" size="xs">
                  <RotateCw />
                  Retry
                </Button>
              }
            />
          </MessageContent>
        </Message>
      </MessageScroller>
    </Chat>
  ),
}

/**
 * The reader stopped the run. Lines that had not finished say `cancelled` in
 * words and with their own mark, the partial answer stays as written, and a
 * quiet note records who stopped it and when.
 */
export const Cancelled: Story = {
  render: () => (
    <Chat
      header={
        <ChatHeader
          title="Check the migration"
          subtitle="adea-ai/ui · feature/user-locale"
          status={<StatusChip tone="neutral" label="Stopped" />}
        />
      }
      composer={
        <Composer placeholder="Write a message…" suggestions={['Continue where you stopped']} />
      }
    >
      <MessageScroller gutter>
        <Message role="user" label="You" anchorId="cancelled-ask">
          <Bubble>{RUN_ASK}</Bubble>
        </Message>
        <Message role="assistant" label="Assistant" anchorId="cancelled-reply">
          <MessageContent>
            <Trace aria-label="Activity">
              <Tool
                name="read_file"
                icon={<FileText />}
                description="db/migrations/0054_add_locale.sql"
                status="success"
                input={{ path: 'db/migrations/0054_add_locale.sql' }}
              />
              <Subagent
                name="Test runner"
                task="Run the unit tests for packages/db"
                status="cancelled"
                model="haiku-4"
                duration={9}
              >
                <Tool
                  name="run_command"
                  icon={<TerminalIcon />}
                  description="bun test packages/db"
                  status="cancelled"
                />
              </Subagent>
            </Trace>
            <MessageText text="The migration adds one nullable column and does not touch existing rows, so it should not break the db tests. I started the db tests to confirm that." />
            <Marker
              variant="note"
              icon={<Ban />}
              label="Cancelled"
              description="You stopped this run at 14:07."
            />
          </MessageContent>
        </Message>
      </MessageScroller>
    </Chat>
  ),
}

/** No turns yet: the empty state offers the host's real prompts and the composer is ready. */
export const Empty: Story = {
  render: () => {
    const [draft, setDraft] = createSignal('')
    return (
      <Chat
        header={
          <ChatHeader
            title="New conversation"
            subtitle="adea-ai/ui · main"
            status={<StatusChip tone="neutral" label="Ready" />}
          />
        }
        composer={
          <ChatComposer
            value={draft()}
            onValueChange={setDraft}
            onSubmit={() => {
              setDraft('')
            }}
            placeholder="Ask about the code, or hand the agent a task…"
          />
        }
      >
        <MessageScroller
          gutter
          empty={
            <ChatEmpty
              title="What are you working on?"
              description="Ask about the code, or hand the agent a task. It shows its work as it goes."
              suggestions={
                <Suggestions label="Ways to start" onSelect={setDraft}>
                  <Suggestion text="Explain how the release is cut" />
                  <Suggestion text="Add a locale column to users" />
                  <Suggestion text="Review my staged changes" />
                </Suggestions>
              }
            />
          }
        />
      </Chat>
    )
  },
}
