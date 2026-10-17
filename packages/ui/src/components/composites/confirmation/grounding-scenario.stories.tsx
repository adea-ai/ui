import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ConversationAvatar } from '../../conversation/conversation-avatar'
import { Bubble } from '../../ui/bubble'
import { Message, MessageContent, MessageHeader } from '../../ui/message'
import { Checkpoint } from '../checkpoint'
import { Context } from '../context'
import { InlineCitation } from '../inline-citation'
import { ModelSelector, type ModelOption } from '../model-selector'
import { Sources, type Source } from '../sources'
import { Suggestion, Suggestions } from '../suggestion'
import { Confirmation } from './confirmation'
import type { ConfirmationState } from './confirmation-model'

/**
 * One coherent turn: the person asks whether a staging migration is safe, the
 * agent answers from two sources and stops to ask before running it. Under the
 * transcript is the row beside the composer: suggestions, the model and effort
 * pickers, and the context figure.
 *
 * Everything on the page is a host claim made visible, and every claim is
 * conditional. The citations and the Sources line exist because the host passed
 * `Source`s; the checkpoint offers Restore because `onRestore` was passed, and its
 * dialog states the host's `consequence`; the confirmation can be answered
 * because both handlers were passed, and who/when appear only once the host
 * settles it; the context figure shows only the numbers the host knew. Remove any
 * of those inputs and the corresponding claim disappears.
 */
const meta = {
  title: 'Composites/Grounding And Controls Scenario',
  component: Message,
  parameters: { layout: 'padded' },
  args: { role: 'assistant', label: 'Assistant' },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="mx-auto flex w-[44rem] max-w-full flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Message>

export default meta
type Story = StoryObj<typeof meta>

const sources: Source[] = [
  {
    id: 'runbook',
    title: 'Staging migration runbook',
    url: 'https://example.com/runbooks/staging-migration',
    snippet: 'Migrations 0053 and 0054 are additive. Run them in order; 0054 depends on 0053.',
  },
  {
    id: 'rollback',
    title: 'Rollback procedure',
    url: 'https://example.com/runbooks/rollback#schema',
    snippet: 'The rollback script restores the previous schema but does not restore deleted rows.',
  },
  { id: 'local', title: 'db/migrations/0054_add_index.sql' },
]

const models: ModelOption[] = [
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

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const command = {
  kind: 'code' as const,
  language: 'sh',
  title: 'bash',
  code: 'bun run --cwd packages/db db:migrate --env staging',
}

export const MigrationReview: Story = {
  render: () => {
    const [state, setState] = createSignal<ConfirmationState>('requested')
    const [composer, setComposer] = createSignal('')
    const [model, setModel] = createSignal('sonnet')
    const [effort, setEffort] = createSignal<string | undefined>('medium')

    return (
      <>
        <Message role="user" label="You">
          <Bubble>Can we ship the staging migration today?</Bubble>
        </Message>

        <Checkpoint
          label="Before the migration"
          time="10:02"
          consequence="Returns the working tree to this point and drops the 3 files the agent has edited since. The conversation itself is kept."
          onRestore={() => pause(900)}
        />

        <Message role="assistant" label="Assistant">
          <MessageHeader avatar={<ConversationAvatar kind="agent" />} time="10:03">
            Assistant
          </MessageHeader>
          <MessageContent>
            <p class="m-0 [overflow-wrap:anywhere]">
              Yes, with one caveat. Both pending migrations are additive and have to run in order
              <InlineCitation index={1} sources={[sources[0]!, sources[2]!]} />, and the rollback
              restores the schema but not deleted rows
              <InlineCitation index={2} sources={[sources[1]!]} />. I would run them on staging
              first and keep the checkpoint above.
            </p>
            <Sources sources={sources} />
            <Confirmation
              state={state()}
              title="Run the staging migration?"
              description="It applies migrations 0053 and 0054 to the staging database. Nothing runs until you answer."
              details={command}
              onApprove={async () => {
                await pause(900)
                setState('approved')
              }}
              onDeny={async () => {
                await pause(500)
                setState('denied')
              }}
              resolvedBy="You"
              resolvedAt="10:04"
            />
          </MessageContent>
        </Message>

        <div class="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          <Suggestions label="Follow-up prompts" layout="scroll" onSelect={setComposer}>
            <Suggestion text="Show me the rollback plan" />
            <Suggestion text="What could lock the table?" />
            <Suggestion text="Run it against a copy first" />
          </Suggestions>
          <p class="m-0 min-h-5 text-sm text-muted-foreground" role="status">
            {composer() ? `Composer: ${composer()}` : 'Composer is empty.'}
          </p>
          <div class="flex items-center justify-between gap-2">
            <ModelSelector
              models={models}
              value={model()}
              effort={effort()}
              onChange={setModel}
              onEffortChange={setEffort}
            />
            <Context
              used={118_400}
              total={200_000}
              breakdown={{ input: 96_200, output: 14_800, cacheRead: 7_400 }}
              cost={{ amount: 0.37, currency: 'USD' }}
            />
          </div>
        </div>
      </>
    )
  },
}

/**
 * The same turn when this client can only watch: no handlers anywhere, so no
 * Restore, disabled approval with the reason in words, read-only model text, no
 * suggestions to choose, and a context trigger that shows only the one figure the
 * host had.
 */
export const ReadOnlyReplay: Story = {
  render: () => (
    <>
      <Message role="user" label="You">
        <Bubble>Can we ship the staging migration today?</Bubble>
      </Message>
      <Checkpoint label="Before the migration" time="10:02" />
      <Message role="assistant" label="Assistant">
        <MessageContent>
          <p class="m-0">
            Yes, with one caveat <InlineCitation sources={[sources[0]!]} />.
          </p>
          <Sources sources={sources.slice(0, 1)} />
          <Confirmation
            state="unavailable"
            title="Run the staging migration?"
            details={command}
            disabledReason="This is a read-only replay. Open the live session to answer."
          />
        </MessageContent>
      </Message>
      <div class="mt-4 flex flex-col gap-2 border-t border-border pt-3">
        <Suggestions label="Follow-up prompts" disabledReason="Replays cannot take new prompts.">
          <Suggestion text="Show me the rollback plan" />
        </Suggestions>
        <div class="flex items-center justify-between gap-2">
          <ModelSelector models={models} value="sonnet" effort="medium" />
          <Context used={118_400} />
        </div>
      </div>
    </>
  ),
}
