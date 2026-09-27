import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Button } from '../ui/button/button'
import type { TranscriptRow } from './transcript-grouping'
import {
  TranscriptComposition,
  type TranscriptCompositionRendererProps,
  type TranscriptCompositionProps,
  type TranscriptFoldState,
} from './transcript-composition'

type StoryMessage = Readonly<{ text: string; detail?: string }>

const rows: readonly TranscriptRow<StoryMessage>[] = [
  { id: 'prompt', value: { text: 'Inspect the new event cursor.' }, opensTurn: 'reset' },
  {
    id: 'thinking-1',
    value: { text: 'Check where the cursor is committed.' },
    reasoning: true,
    fold: 'prose',
  },
  {
    id: 'call-1-request',
    value: { text: 'Read the event cursor implementation.', detail: 'src/server/event-cursor.ts' },
    working: true,
    fold: 'tool',
    call: { phase: 'request', id: 'call-1' },
  },
  {
    id: 'call-1-result',
    value: { text: 'The cursor advances after commit.', detail: 'Result for call-1' },
    working: true,
    fold: 'tool',
    call: { phase: 'result', id: 'call-1' },
  },
  {
    id: 'approval',
    value: { text: 'Approval required before writing the cursor.' },
    fold: 'tool',
    alwaysVisible: true,
  },
  {
    id: 'diff',
    value: { text: 'Review the proposed event-log diff.' },
    fold: 'tool',
    alwaysVisible: true,
  },
  {
    id: 'answer',
    value: { text: 'The cursor advances only after the event commits.' },
    fold: 'prose',
    conclusion: true,
    turnEnd: true,
  },
]

const mixedSynthesisRows: readonly TranscriptRow<StoryMessage>[] = [
  { id: 'mixed-prompt', value: { text: 'Explain the proposed change.' }, opensTurn: 'reset' },
  {
    id: 'mixed-request',
    value: { text: 'Inspect the changed module.' },
    working: true,
    fold: 'tool',
    call: { phase: 'request', id: 'mixed-call' },
  },
  {
    id: 'mixed-result',
    value: { text: 'The module keeps its public contract.' },
    working: true,
    fold: 'tool',
    call: { phase: 'result', id: 'mixed-call' },
  },
  {
    id: 'mixed-work',
    value: { text: 'The prior activity remains in this turn.' },
    working: true,
    fold: 'prose',
  },
  {
    id: 'mixed-synthesis',
    value: { text: 'The synthesis summarizes the preceding activity.' },
    synthesis: true,
    fold: 'prose',
  },
  {
    id: 'mixed-answer',
    value: { text: 'The public contract is preserved.' },
    fold: 'prose',
    conclusion: true,
  },
]

function StoryMessage(props: TranscriptCompositionRendererProps<StoryMessage>) {
  return (
    <article class="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span>{props.row.value.text}</span>
      {props.row.value.detail && (
        <span class="text-muted-foreground text-sm">{props.row.value.detail}</span>
      )}
      {props.context.turn && (
        <span class="text-muted-foreground text-sm">
          Turn presentation · {props.context.turn.complete ? 'settled' : 'running'}
        </span>
      )}
    </article>
  )
}

const StoryTranscriptComposition = (props: TranscriptCompositionProps<StoryMessage>) => (
  <TranscriptComposition {...props} />
)

const meta = {
  title: 'Conversation/Transcript composition',
  component: StoryTranscriptComposition,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof TranscriptComposition>

export default meta
type Story = StoryObj<typeof meta>

/** Host rows remain ordered; the tool disclosure counts requests, not results. */
export const DefaultToolFold: Story = {
  args: { rows, renderRow: StoryMessage },
  render: () => (
    <div class="flex w-[44rem] flex-col gap-3 rounded-xl border border-border p-4">
      <p class="text-muted-foreground text-sm">
        The settled tool rows start folded. Approval, diff and the final answer stay visible.
      </p>
      <TranscriptComposition rows={rows} resetKey="event-cursor" renderRow={StoryMessage} />
    </div>
  ),
}

/** Collapse-all hides activity without unmounting prose or a proven answer. */
export const CollapseAllRetainsProse: Story = {
  args: { rows, renderRow: StoryMessage },
  render: () => {
    const [foldState, setFoldState] = createSignal<TranscriptFoldState>('collapsed')
    return (
      <div class="flex w-[44rem] flex-col gap-3 rounded-xl border border-border p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setFoldState((value) => (value === 'collapsed' ? 'expanded' : 'collapsed'))
          }
        >
          Toggle collapsed content
        </Button>
        <TranscriptComposition
          rows={rows}
          resetKey="event-cursor"
          foldState={foldState()}
          renderRow={StoryMessage}
        />
      </div>
    )
  },
}

/** A mixed interim/synthesis disclosure never hides the host-marked conclusion. */
export const MixedInterimConclusion: Story = {
  args: { rows: mixedSynthesisRows, renderRow: StoryMessage },
  render: () => (
    <div class="flex w-[44rem] flex-col gap-3 rounded-xl border border-border p-4">
      <p class="text-muted-foreground text-sm">
        The collapsed interim scope contains a synthesis and a final answer without an intervening
        turn opener; the answer remains visible.
      </p>
      <TranscriptComposition
        rows={mixedSynthesisRows}
        resetKey="interim-synthesis"
        foldState="collapsed"
        renderRow={StoryMessage}
      />
    </div>
  ),
}

/** Running rows remain open; actionable host content remains outside every fold. */
export const StreamingTurn: Story = {
  args: { rows, renderRow: StoryMessage },
  render: () => {
    const [running, setRunning] = createSignal(true)
    return (
      <div class="flex w-[44rem] flex-col gap-3 rounded-xl border border-border p-4">
        <Button variant="outline" size="sm" onClick={() => setRunning((value) => !value)}>
          Toggle live state
        </Button>
        <TranscriptComposition
          rows={rows}
          running={running()}
          resetKey="event-cursor"
          renderRow={StoryMessage}
        />
      </div>
    )
  },
}
