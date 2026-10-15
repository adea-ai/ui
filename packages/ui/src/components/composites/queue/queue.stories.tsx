import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Queue, QueueFollowUps, type QueueFollowUp, type QueueItem } from './queue'

const meta = {
  title: 'Composites/Queue',
  component: Queue,
  tags: ['autodocs'],
  args: { items: [] },
  parameters: {
    docs: {
      description: {
        component:
          "The agent's todo list in two collapsible sections, Pending (open) and Completed (folded), each with its count. An item is completed only when the host marked it complete. `QueueFollowUps` lists the person's own follow-up messages waiting to be delivered; a remove control exists only for a message that carries `onRemove`.",
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Queue>

export default meta
type Story = StoryObj<typeof meta>

const items: readonly QueueItem[] = [
  { text: 'Read the migration plan', status: 'complete' },
  { text: 'Add the nullable column', status: 'complete' },
  {
    text: 'Backfill locale in batches',
    description: 'Paused between batches',
    status: 'active',
  },
  { text: 'Add the not-null constraint', status: 'pending' },
  { text: 'Create the index concurrently' },
]

export const Default: Story = {
  args: { items },
}

/** Open both sections to compare. */
export const BothOpen: Story = {
  args: { items, defaultCompletedOpen: true },
}

/** Nothing finished yet: only a Pending section, no "Completed (0)". */
export const OnlyPending: Story = {
  args: { items: items.filter((item) => item.status !== 'complete') },
}

/** Everything finished: only the Completed section. */
export const AllCompleted: Story = {
  args: {
    items: items.map((item) => ({ ...item, status: 'complete' as const })),
    defaultCompletedOpen: true,
  },
}

/** No status on any item: all of it is still to do, which is what "not marked done" means. */
export const NoStatuses: Story = {
  args: { items: [{ text: 'Triage the inbox' }, { text: 'Reply to the review' }] },
}

/** An empty list draws nothing... */
export const Empty: Story = {
  args: { items: [] },
  // The queue itself is empty, so the frame is what makes the story visible.
  render: (args) => (
    <div class="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
      <p class="m-0">Nothing is drawn between the lines.</p>
      <Queue {...args} />
      <p class="m-0">Nothing is drawn between the lines.</p>
    </div>
  ),
}

/** ...unless the host gives it words. */
export const EmptyWithMessage: Story = {
  args: { items: [], empty: 'Nothing queued' },
}

/** Long text wraps and clamps to three lines. */
export const LongText: Story = {
  args: {
    items: [
      {
        text: 'Reconcile the billing export with the ledger for every account that changed plan during the migration window, including accounts that were later merged into another account and so no longer appear in the source table',
        description: 'Also long, in a smaller voice. '.repeat(8),
      },
      { text: 'z'.repeat(3_000) },
    ],
  },
}

/** Two hundred items scroll inside each section. */
export const TwoHundredItems: Story = {
  args: {
    defaultCompletedOpen: true,
    items: Array.from({ length: 200 }, (_, index) => ({
      text: `Process shard ${index + 1}`,
      status: index < 100 ? ('complete' as const) : undefined,
    })),
  },
}

const waiting: readonly QueueFollowUp[] = [
  { text: 'Also update the README when you are done', onRemove: () => undefined },
  { text: 'And run the full test suite afterwards', onRemove: () => undefined },
]

/** Removable follow-ups. Removing one keeps keyboard focus on a neighbouring remove button. */
export const FollowUps: StoryObj = {
  render: () => {
    const [list, setList] = createSignal<readonly string[]>([
      'Also update the README when you are done',
      'And run the full test suite afterwards',
      'Then open a draft PR',
    ])
    const followUps = () =>
      list().map((text, index) => ({
        text,
        onRemove: () => setList((current) => current.filter((_, at) => at !== index)),
      }))
    return <QueueFollowUps items={followUps()} />
  },
}

/** The runtime has taken these: nothing can be withdrawn, so there are no buttons. */
export const FollowUpsReadOnly: StoryObj = {
  render: () => <QueueFollowUps items={waiting.map(({ text }) => ({ text }))} />,
}

/** Some can still be withdrawn and some cannot; the control is per message. */
export const FollowUpsMixed: StoryObj = {
  render: () => (
    <QueueFollowUps
      items={[
        { text: 'Still removable', onRemove: () => undefined },
        { text: 'Already past recall' },
      ]}
    />
  ),
}

/** A long message wraps and clamps; its remove label is shortened but names the message. */
export const FollowUpsLongText: StoryObj = {
  render: () => (
    <QueueFollowUps
      items={[
        {
          text: 'Please also make sure that when you update the documentation you keep the examples in sync with the actual behaviour of the component, because last time they drifted and the review caught it late.',
          onRemove: () => undefined,
        },
        { text: 'q'.repeat(2_500), onRemove: () => undefined },
      ]}
    />
  ),
}

/** Nothing waiting: nothing is drawn. */
export const FollowUpsEmpty: StoryObj = {
  render: () => (
    <div class="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
      <p class="m-0">Nothing is drawn between the lines.</p>
      <QueueFollowUps items={[]} />
      <p class="m-0">Nothing is drawn between the lines.</p>
    </div>
  ),
}
