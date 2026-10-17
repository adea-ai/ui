import { createSignal, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../../ui/button'
import { Trace } from '../../ui/trace'
import { Plan, type PlanStep } from './plan'

const meta = {
  title: 'Composites/Plan',
  component: Plan,
  tags: ['autodocs'],
  args: { title: 'Add a locale column', steps: [] },
  parameters: {
    docs: {
      description: {
        component:
          'What the agent intends to do, as a Trace line that opens by default: a description, the steps with status, progress in words plus a bar, and an optional actions slot. While streaming it shimmers and claims no progress. With no actions there are no controls.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Trace aria-label="Activity">
          <Story />
        </Trace>
      </div>
    ),
  ],
} satisfies Meta<typeof Plan>

export default meta
type Story = StoryObj<typeof meta>

const steps: readonly PlanStep[] = [
  { label: 'Add a nullable locale column to users', status: 'complete' },
  {
    label: 'Backfill from profile.language in batches',
    description: '5,000 rows at a time, with a pause between batches',
    status: 'active',
  },
  { label: 'Add the not-null constraint', status: 'pending' },
  { label: 'Create the index concurrently', status: 'pending' },
  { label: 'Remove the old profile.language reads', status: 'pending' },
]

const actions = (
  <>
    <Button size="xs">Approve plan</Button>
    <Button size="xs" variant="outline">
      Edit
    </Button>
  </>
)

/** Under way: two words and a bar say how far along, and the reader can still act. */
export const InProgress: Story = {
  args: {
    description: 'Adds locale without locking the users table.',
    steps,
    actions,
  },
}

/** No actions passed, so there are no controls: a plan the reader may not approve has no Approve button. */
export const ReadOnly: Story = {
  args: { steps },
}

/** Folded: the line alone carries the title and the progress. */
export const Collapsed: Story = {
  args: { steps, defaultOpen: false },
}

/** No step carries a status: no bar and no count, because none is known. */
export const NoStatuses: Story = {
  args: {
    description: 'Not started.',
    steps: steps.map(({ label, description }) => ({ label, description })),
    actions,
  },
}

/** Everything done, and a step that was skipped and one that failed. */
export const MixedOutcomes: Story = {
  args: {
    steps: [
      { label: 'Add the column', status: 'complete' },
      { label: 'Backfill', status: 'failed', description: 'Lock timeout on batch 14' },
      { label: 'Add the constraint', status: 'skipped' },
    ],
  },
}

/** Still being written: shimmering title, "Drafting", a caret, and no progress claimed. */
export const Streaming: Story = {
  args: {
    streaming: true,
    description: 'Adds locale without lock',
    steps: [
      { label: 'Add a nullable locale column to users' },
      { label: 'Backfill from profile.lang' },
    ],
  },
}

/** Streaming has started and nothing has arrived. */
export const StreamingNothingYet: Story = {
  args: { streaming: true, steps: [] },
}

/** Watch steps arrive, then the plan settle and show progress. */
export const LiveStream: Story = {
  render: () => {
    const all: readonly PlanStep[] = steps.map(({ label }) => ({
      label,
      status: 'pending' as const,
    }))
    const [count, setCount] = createSignal(0)
    const [streaming, setStreaming] = createSignal(true)
    let timer: ReturnType<typeof setInterval> | undefined
    const run = () => {
      if (timer) clearInterval(timer)
      setCount(0)
      setStreaming(true)
      timer = setInterval(() => {
        setCount((value) => value + 1)
        if (count() >= all.length) {
          clearInterval(timer)
          setStreaming(false)
        }
      }, 700)
    }
    run()
    onCleanup(() => timer && clearInterval(timer))
    return (
      <>
        <Plan
          title="Add a locale column"
          steps={all.slice(0, count())}
          streaming={streaming()}
          actions={streaming() ? undefined : actions}
        />
        <li class="list-none pt-2">
          <Button size="sm" variant="outline" onClick={run}>
            Replay
          </Button>
        </li>
      </>
    )
  },
}

/** No steps, no description and no actions: a plain line. */
export const TitleOnly: Story = {
  args: { steps: [] },
}

/** Long steps wrap to three lines and are clamped. */
export const LongSteps: Story = {
  args: {
    title: 'A plan whose title is rather long, because the model was feeling thorough that day',
    steps: [
      {
        label:
          'Rewrite every call site of the old helper to the new signature, taking care to preserve the argument order in the places that pass a callback as the final parameter and to leave the generated files alone',
        status: 'active',
      },
      { label: 'y'.repeat(4_000), status: 'pending' },
    ],
  },
}

/** Two hundred steps scroll inside the plan. */
export const TwoHundredSteps: Story = {
  args: {
    steps: Array.from({ length: 200 }, (_, index) => ({
      label: `Migrate package ${index + 1}`,
      status: index < 60 ? ('complete' as const) : ('pending' as const),
    })),
    actions,
  },
}
