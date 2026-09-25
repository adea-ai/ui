import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Button } from '../button/button'

/**
 * Alert.
 *
 * A message about the whole surface it sits in — a form's validation summary, a
 * failed sync banner, a permission notice. It is deliberately not a dialog: an
 * alert that must be dismissed before the user can continue is a Dialog.
 *
 * The glyph follows the tone rather than being passed in, so an alert cannot be
 * given a green checkmark on a destructive fill.
 */
const meta = {
  title: 'Primitives/Feedback/Alert',
  component: Alert,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'info'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

/** Each tone with its title and description, which is the full form. */
export const Tones: Story = {
  render: () => (
    <div class="flex w-144 flex-col gap-3">
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>
          The workspace is running in local-only mode. Changes are not synced.
        </AlertDescription>
      </Alert>
      <Alert variant="info">
        <AlertTitle>Update available</AlertTitle>
        <AlertDescription>Version 0.56.0 is ready to install.</AlertDescription>
      </Alert>
      <Alert variant="success">
        <AlertTitle>Migration complete</AlertTitle>
        <AlertDescription>Fourteen worktrees were materialised read-only.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Budget nearly spent</AlertTitle>
        <AlertDescription>
          The soak lane has 42 minutes of its 24-hour budget left.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Two checks failed</AlertTitle>
        <AlertDescription>
          The worktree evidence lane could not read the base directory.
        </AlertDescription>
      </Alert>
    </div>
  ),
}

/** A title on its own, for a one-line notice. */
export const TitleOnly: Story = {
  render: () => (
    <Alert class="w-144" variant="success">
      <AlertTitle>Saved</AlertTitle>
    </Alert>
  ),
}

/** A banner with a trailing action, which is how a recovery notice reads. */
export const WithAction: Story = {
  render: () => (
    <Alert class="w-144" variant="destructive">
      <AlertTitle>Could not reach the control plane</AlertTitle>
      <AlertDescription>
        <p class="mb-3">The last sync was 14 minutes ago. Local work is unaffected.</p>
        <Button size="sm" variant="outline">
          Retry now
        </Button>
      </AlertDescription>
    </Alert>
  ),
}

/** `icon={null}` for a message whose content already carries the meaning. */
export const WithoutIcon: Story = {
  render: () => (
    <Alert class="w-144" icon={null}>
      <AlertTitle>Keyboard shortcuts</AlertTitle>
      <AlertDescription>
        Open the command palette with ⌘K. Every action is reachable from there.
      </AlertDescription>
    </Alert>
  ),
}
