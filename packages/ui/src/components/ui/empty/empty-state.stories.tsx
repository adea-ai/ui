import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { EmptyState } from './empty-state'

const meta = {
  title: 'Composites/Feedback/Empty State',
  component: EmptyState,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

/** A polite loading state announces progress without duplicating spinner text. */
export const Loading: Story = {
  args: {
    title: 'Loading knowledge graph',
    detail: 'Mapping indexed workspaces and documents…',
    announceAs: 'status',
    busy: true,
    class: 'min-h-64 border',
  },
}

/** Errors are assertively announced and offer a named, focusable retry action. */
export const ErrorWithRetry: Story = {
  args: {
    title: 'Could not load this workspace',
    detail: 'Check your connection, then try again.',
    announceAs: 'alert',
    actionLabel: 'Try again',
    actionTooltip: 'Retry loading this workspace',
    onClick: undefined,
    class: 'min-h-64 border',
  },
  render: (args) => <EmptyState {...args} action={() => {}} />,
}

/**
 * Two ways out: the primary action first, a quieter `secondary` one after it.
 * They sit side by side and wrap together on a narrow pane, and the tab order is
 * the reading order. Reach for `Empty` and its parts when a state needs more
 * than two, or an action that is not a button.
 */
export const ErrorWithTwoActions: Story = {
  args: {
    title: 'Sync health unavailable',
    detail: 'The status snapshot did not load. Retry, or review the configuration.',
    announceAs: 'alert',
    headingLevel: 2,
    action: () => {},
    actionLabel: 'Retry status',
    secondaryAction: () => {},
    secondaryActionLabel: 'Open settings',
    secondaryActionTooltip: 'Review configuration and resolve setup requirements.',
    class: 'min-h-64 border',
  },
}

/** Narrow enough that the two buttons no longer fit on one line. */
export const TwoActionsWrapInANarrowPane: Story = {
  args: ErrorWithTwoActions.args,
  render: (args) => (
    <div class="w-56">
      <EmptyState {...args} />
    </div>
  ),
}
