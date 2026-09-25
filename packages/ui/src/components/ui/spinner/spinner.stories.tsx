import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Spinner } from './spinner'

/**
 * Spinner.
 *
 * A determinate-length activity indicator with no progress to report. When there
 * *is* progress, use Progress instead — a spinner next to a known percentage is a lie
 * about what the app knows.
 *
 * The glyph spins continuously, so it is the one thing in the system that keeps
 * moving under `prefers-reduced-motion`; a frozen spinner reads as a hang, which is
 * worse than motion for exactly the people who asked for less of it.
 */
const meta = {
  title: 'Primitives/Feedback/Spinner',
  component: Spinner,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    label: { control: 'text' },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div class="flex items-center gap-6">
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <Spinner size="xl" />
    </div>
  ),
}

/** In context: a spinner replaces a button's label rather than sitting beside it. */
export const InAButton: Story = {
  render: () => (
    <button
      type="button"
      disabled
      class="inline-flex h-control-md items-center gap-2 rounded-md bg-primary px-control-md text-sm font-medium text-primary-foreground opacity-50"
    >
      <Spinner size="sm" class="text-primary-foreground" />
      Saving…
    </button>
  ),
}

/**
 * `label={false}` for a spinner inside a region that already announces itself.
 *
 * Without it, a row of three spinners announces "Loading" three times.
 */
export const WithoutLabel: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-3" role="status" aria-label="Loading results">
      <div class="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
        <Spinner label={false} size="sm" />
        Reading the worktree manifest…
      </div>
      <p class="text-sm text-muted-foreground">
        The region owns the announcement; the glyph inside it does not repeat it.
      </p>
    </div>
  ),
}
