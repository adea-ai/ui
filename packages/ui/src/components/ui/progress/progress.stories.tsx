import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Progress } from './progress'

/**
 * Progress.
 *
 * A determinate bar. Kobalte publishes the value as `aria-valuenow`, so a screen
 * reader reports the percentage instead of just "progress bar" — which is why a
 * caller must pass a real `value`, or use Spinner when there is none.
 *
 * `indeterminate` renders a sweeping bar for an operation that reports no progress
 * at all. It is a visibly different treatment so the two states are never confused
 * by someone glancing at the screen.
 */
const meta = {
  title: 'Primitives/Feedback/Progress',
  component: Progress,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

/** A labelled bar with its numeric readout. */
export const Default: Story = {
  render: () => (
    <div class="w-96">
      <Progress value={64} label="Materialising worktrees" />
    </div>
  ),
}

/** The readout suppressed, for a bar whose number is not meaningful to show. */
export const WithoutValueLabel: Story = {
  render: () => (
    <div class="w-96">
      <Progress value={32} label="Uploading build artifacts" hideValue />
    </div>
  ),
}

/** Every meaningful stage, so the bar's range is legible at a glance. */
export const Range: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-4">
      {[0, 25, 50, 75, 100].map((value) => (
        <Progress value={value} label={`${value}%`} />
      ))}
    </div>
  ),
}

/**
 * Indeterminate, for work with no measurable progress.
 *
 * Note that this is not a value stuck at 90% — a determinate bar that never moves
 * reads as a hang, which is the exact impression the indeterminate sweep exists to
 * avoid.
 */
export const Indeterminate: Story = {
  render: () => (
    <div class="flex w-96 flex-col gap-3">
      <Progress indeterminate label="Connecting to the control plane" />
      <p class="text-sm text-muted-foreground">
        A sweep rather than a stalled bar: an operation that reports no progress must not look like
        one that is nearly done.
      </p>
    </div>
  ),
}
