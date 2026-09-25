import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Badge } from './badge'

/**
 * Badge.
 *
 * A short, non-interactive status label. If it can be clicked it is a Button
 * with `size="2xs"`, not a Badge — the difference matters because a Badge
 * carries no focus or pressed state and must never be the only route to an
 * action, since it cannot be reached by keyboard.
 */
const meta = {
  title: 'Primitives/Data display/Badge',
  component: Badge,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'subtle',
        'success',
        'warning',
        'destructive',
        'info',
      ],
      description: 'Status meaning. The `-subtle` family is a tinted fill on any surface.',
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: { children: 'Badge' },
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * The variants.
 *
 * The tinted family (`success`, `warning`, `destructive`, `info`, `subtle`) is
 * for reporting a *state*: "3 passed", "needs review". The solid family
 * (`default`, `secondary`) is for a label that is not a status — a role, a plan
 * tier. Using a solid red badge for a status makes the status shout as loudly as
 * the primary action beside it.
 */
export const Variants: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="subtle">Subtle</Badge>
      <Badge variant="success">Passed</Badge>
      <Badge variant="warning">Skipped</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="info">Queued</Badge>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-2">
      <Badge size="sm">sm</Badge>
      <Badge size="md">md</Badge>
      <Badge size="lg">lg</Badge>
    </div>
  ),
}

/**
 * The shape a row of statuses actually takes: one badge per outcome, in the same
 * size, so the row can be read as a total rather than as five separate claims.
 */
export const StatusRow: Story = {
  render: () => (
    <div class="flex items-center gap-2">
      <Badge variant="success">142 passed</Badge>
      <Badge variant="warning">3 skipped</Badge>
      <Badge variant="destructive">1 failed</Badge>
      <Badge variant="outline">2m 14s</Badge>
    </div>
  ),
}

/** A badge carrying a count, which is the most common trailing element. */
export const Counts: Story = {
  render: () => (
    <div class="flex items-center gap-2">
      <Badge variant="secondary">12</Badge>
      <Badge variant="secondary">99+</Badge>
      <Badge variant="destructive">3</Badge>
    </div>
  ),
}
