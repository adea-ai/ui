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
