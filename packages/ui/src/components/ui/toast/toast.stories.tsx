import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import { Toaster, toast } from './toast'

/**
 * Toast.
 *
 * A short, self-dismissing message about something that already happened. The rules
 * that make toasts helpful rather than hostile are built into this API rather than
 * left to callers:
 *
 *   - A toast never carries the only route to an action. Anything important enough
 *     to need doing belongs in the interface, not in a message that disappears.
 *   - A failure the user caused is announced; a sync finishing quietly is not.
 *     `priority` follows from that.
 *   - Where an action is reversible, an undo toast beats a confirmation dialog. Undo
 *     after the fact costs the user nothing; a modal before it costs everyone a click.
 *
 * `Toaster` is mounted once, near the root of the app. The buttons below call the
 * module-level `toast` API, which is why they work from anywhere.
 */
const meta = {
  title: 'Primitives/Feedback/Toast',
  component: Toaster,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

/** The four tones, each raised from a button. */
export const Tones: Story = {
  render: () => (
    <>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.show({ title: 'Copied to clipboard' })}
        >
          Default
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success('Worktree created', { description: 'CoW · 0ms' })}
        >
          Success
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.warning('Budget nearly spent', { description: '42 minutes left of 24 hours.' })
          }
        >
          Warning
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.error('Could not reach the control plane', {
              description: 'Local work is unaffected. Retrying in 30s.',
            })
          }
        >
          Error
        </Button>
      </div>
      <Toaster />
    </>
  ),
}

/**
 * An undo, which is the pattern this component exists to make cheap.
 *
 * The row is gone immediately and the message offers a way back. Compare with an
 * AlertDialog: the same protection, without making everyone answer a question they
 * usually do not care about.
 */
export const WithUndo: Story = {
  render: () => (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          toast.show({
            title: 'Session archived',
            description: 'worktree evidence · 14 messages',
            action: (
              <Button size="xs" variant="outline" onClick={() => toast.dismiss(0)}>
                Undo
              </Button>
            ),
          })
        }
      >
        Archive a session
      </Button>
      <Toaster />
    </>
  ),
}

/**
 * A promise toast: one message that resolves, instead of three that queue.
 *
 * The failure case is `persistent`, because a failure the user missed is a failure
 * that did not happen.
 */
export const PromiseToast: Story = {
  render: () => (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
            pending: 'Materialising worktrees…',
            success: 'Four worktrees ready',
            error: 'Could not read the base directory',
          })
        }
      >
        Run a slow operation
      </Button>
      <Toaster />
    </>
  ),
}

/** Persistent and stacked, which is what a burst of notifications looks like. */
export const Stacked: Story = {
  render: () => (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          toast.success('soak · passed', { description: '24h 00m, budget honoured' })
          toast.warning('endurance · skipped', { description: 'Host was asleep' })
          toast.error('preview-perf · failed', { description: 'Frame budget exceeded' })
        }}
      >
        Raise three at once
      </Button>
      <Toaster />
    </>
  ),
}
