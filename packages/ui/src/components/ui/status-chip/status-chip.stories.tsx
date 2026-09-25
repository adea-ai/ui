import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { StatusChip, StatusList } from './status-chip'

const meta = {
  title: 'UI/Status Chip',
  component: StatusChip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A state said in one word, with the reason on hover. The tones are a fixed six rather than a palette: `unknown` is distinct from `neutral` on purpose, because "we have not been told" and "nothing is wrong" are different facts.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'success', 'warning', 'danger', 'info', 'unknown'],
    },
  },
} satisfies Meta<typeof StatusChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: 'Ready', tone: 'success' } }

export const Tones: Story = {
  render: () => (
    <div class="grid gap-3">
      <StatusChip tone="neutral" label="Idle" />
      <StatusChip tone="success" label="Ready" detail="Every local prerequisite is satisfied." />
      <StatusChip
        tone="warning"
        label="Needs configuration"
        detail="No model provider is selected."
      />
      <StatusChip tone="danger" label="Blocked" detail="The workspace key could not be read." />
      <StatusChip tone="info" label="In progress" detail="Started 4 minutes ago." />
      <StatusChip
        tone="unknown"
        label="Activity unknown"
        detail="No runtime events have arrived yet."
      />
    </div>
  ),
}

/**
 * The distinction the sixth tone exists for. Both of these are grey; only one of
 * them is a fact. Collapsing them is how a product quietly lies.
 */
export const UnknownVersusNeutral: Story = {
  render: () => (
    <div class="grid gap-4">
      <div class="grid gap-1">
        <StatusChip tone="neutral" label="Idle" />
        <p class="text-xs text-muted-foreground">
          Nothing is happening, and that is the whole truth.
        </p>
      </div>
      <div class="grid gap-1">
        <StatusChip tone="unknown" label="Activity unknown" />
        <p class="text-xs text-muted-foreground">
          We have not been told. The hollow ring also survives greyscale.
        </p>
      </div>
    </div>
  ),
}

/** With a trailing slot: the timestamp, the retry, the count. */
export const WithTrailing: Story = {
  render: () => (
    <div class="grid gap-3">
      <StatusChip
        tone="success"
        label="Synced"
        trailing={<span class="text-muted-foreground">· 2m ago</span>}
      />
      <StatusChip
        tone="danger"
        label="Failed"
        detail="The last three attempts were rejected by the provider."
        trailing={
          <Button variant="ghost" size="2xs">
            Retry
          </Button>
        }
      />
    </div>
  ),
}

/**
 * `StatusList` is the several-facets-of-one-thing shape — an agent with a
 * configuration state, a runtime state and an activity state. The names line up
 * without a table's semantics.
 */
export const Facets: Story = {
  render: () => (
    <StatusList
      class="max-w-md"
      entries={[
        { id: 'config', name: 'Configuration', tone: 'success', label: 'Configured' },
        {
          id: 'runtime',
          name: 'Runtime',
          tone: 'unknown',
          label: 'Runtime unknown',
          detail: 'Runtime availability becomes authoritative with RuntimeConnection data.',
        },
        {
          id: 'activity',
          name: 'Activity',
          tone: 'unknown',
          label: 'Activity unknown',
          detail: 'Execution activity becomes authoritative with execution events.',
        },
      ]}
    />
  ),
}

/** `compact` drops the names for a badge strip. */
export const CompactFacets: Story = {
  render: () => (
    <StatusList
      compact
      entries={[
        { id: 'a', name: 'Configuration', tone: 'success', label: 'Configured' },
        { id: 'b', name: 'Runtime', tone: 'warning', label: 'Needs configuration' },
      ]}
    />
  ),
}
