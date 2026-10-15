import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Checkpoint } from './checkpoint'

const RLO = String.fromCharCode(0x202e)

const meta = {
  title: 'Composites/Checkpoint',
  component: Checkpoint,
  tags: ['autodocs'],
  args: { label: 'Before the refactor', time: '10:02' },
  parameters: {
    docs: {
      description: {
        component:
          "A point in the conversation: a quiet divider with a label and a time. Restore exists only when the host passes onRestore, and it asks first, naming what will change in the host's own words. Without a handler it is a plain marker, not a disabled button.",
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
} satisfies Meta<typeof Checkpoint>

export default meta
type Story = StoryObj<typeof meta>

/** No handler: a static, honest marker. There is no Restore, not even a disabled one. */
export const Static: Story = {}

export const NoLabel: Story = {
  args: { label: undefined, time: undefined },
}

/** The control appears because the host passed a handler; the dialog states the consequence it supplied. */
export const Restorable: Story = {
  args: {
    onRestore: () => undefined,
    consequence:
      'Undoes the 14 file edits and 3 commands made after 10:02. Messages stay; the working tree returns to this point.',
  },
}

/** Without a consequence the dialog says only what a restore always means. */
export const NoConsequence: Story = {
  args: { onRestore: () => undefined },
}

/**
 * The full round trip with no `state` given: the component follows the promise.
 * The first restore fails (the button comes back as "Try again", the reason is
 * in words), the second succeeds and the control gives way to "Restored" with
 * focus moved to the status line.
 */
export const RoundTrip: Story = {
  render: () => {
    let attempts = 0
    return (
      <Checkpoint
        label="Before the refactor"
        time="10:02"
        consequence="Undoes the 14 file edits made after this point."
        onRestore={async () => {
          attempts += 1
          await new Promise((resolve) => setTimeout(resolve, 1200))
          if (attempts === 1) throw new Error('The workspace is locked by another run.')
        }}
      />
    )
  },
}

/** In flight, driven by the host: the control stays focusable but refuses input. */
export const Restoring: Story = {
  args: { state: 'restoring', onRestore: () => undefined },
}

export const Failed: Story = {
  args: {
    state: 'failed',
    error: 'The snapshot is no longer available.',
    onRestore: () => undefined,
  },
}

export const Restored: Story = {
  args: { state: 'restored', onRestore: () => undefined },
}

/** The host decides it cannot be used now; the reason is in words, the control stays visible. */
export const DisabledWithReason: Story = {
  args: {
    onRestore: () => undefined,
    disabledReason: 'Wait for the current run to finish before restoring.',
  },
}

/** Hostile and oversized text is bounded and cleaned, and rendered as text. */
export const HostileValues: Story = {
  args: {
    label: `<img src=x onerror=alert(1)> ${'Very long name '.repeat(20)}${RLO}fdp.exe`,
    time: 'T'.repeat(300),
    onRestore: () => undefined,
    consequence: '<script>alert(1)</script> '.repeat(60),
  },
}
