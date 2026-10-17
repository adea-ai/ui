import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Confirmation } from './confirmation'
import type { ConfirmationState } from './confirmation-model'

const RLO = String.fromCharCode(0x202e)

const meta = {
  title: 'Composites/Confirmation',
  component: Confirmation,
  tags: ['autodocs'],
  args: { title: 'Run a shell command?' },
  parameters: {
    docs: {
      description: {
        component:
          'The agent has stopped a tool until the person approves or denies it. The one composite allowed a card, because the reader must act on it; the border takes the focus colour only while it waits. Approve and Deny exist only while the request is open and are never hidden: with no handler, or a host reason, they are disabled and the reason is in words. After the answer, one quiet line replaces them, with who and when only if the host supplied them.',
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
} satisfies Meta<typeof Confirmation>

export default meta
type Story = StoryObj<typeof meta>

const command = {
  kind: 'code' as const,
  language: 'sh',
  title: 'bash',
  code: 'bun run --cwd packages/db db:migrate --env staging',
}

const patch = [
  'diff --git a/src/config.ts b/src/config.ts',
  '--- a/src/config.ts',
  '+++ b/src/config.ts',
  '@@ -1,4 +1,4 @@',
  ' export const config = {',
  '-  retries: 1,',
  '+  retries: 3,',
  ' }',
].join('\n')

export const Requested: Story = {
  args: {
    description: 'It will migrate the staging database. Nothing runs until you answer.',
    details: command,
    onApprove: () => undefined,
    onDeny: () => undefined,
  },
}

/** A patch is evidence too: the diff block, capped in height and reachable by keyboard when it scrolls. */
export const WithDiff: Story = {
  args: {
    title: 'Edit src/config.ts?',
    details: { kind: 'diff', patch },
    onApprove: () => undefined,
    onDeny: () => undefined,
  },
}

/**
 * A full round trip. The first answer fails (the host's `error` is not set, so the
 * rejection's own message shows and the buttons come back); the second takes a
 * second, shows the spinner on the pressed button, refuses a double click, and then
 * the host settles the state, which swaps the buttons for the outcome and keeps
 * focus in the card.
 */
export const RoundTrip: Story = {
  render: () => {
    const [state, setState] = createSignal<ConfirmationState>('requested')
    let attempts = 0
    const answer = (next: ConfirmationState) => async () => {
      attempts += 1
      await new Promise((resolve) => setTimeout(resolve, 900))
      if (attempts === 1) throw new Error('The session did not accept the answer.')
      setState(next)
    }
    return (
      <Confirmation
        state={state()}
        title="Run a shell command?"
        description="It will migrate the staging database."
        details={command}
        onApprove={answer('approved')}
        onDeny={answer('denied')}
        resolvedBy="You"
        resolvedAt="10:02"
      />
    )
  },
}

/** The host reports the failure itself; its text wins over the rejection's. */
export const HostError: Story = {
  args: {
    details: command,
    onApprove: () => undefined,
    onDeny: () => undefined,
    error: 'The runner is reconnecting. Your answer was not delivered.',
  },
}

/** No handlers: both buttons stay, disabled, and the card says why. */
export const NoHandlers: Story = {
  args: { details: command, description: 'This transcript is a read-only replay.' },
}

/** Offline: the request is still open, so the choice stays visible and the reason is in words. */
export const Unavailable: Story = {
  args: {
    state: 'unavailable',
    details: command,
    disabledReason: 'You are offline. Reconnect to answer; the agent keeps waiting.',
    onApprove: () => undefined,
    onDeny: () => undefined,
  },
}

/** Unavailable with no reason from the host still says so. */
export const UnavailableNoReason: Story = {
  args: { state: 'unavailable', details: command },
}

/** Settled: one quiet line, who and when because the host knew them. */
export const Approved: Story = {
  args: { state: 'approved', details: command, resolvedBy: 'Ana', resolvedAt: '10:02' },
}

/** Settled with nothing else known: only what the state itself says. */
export const Denied: Story = {
  args: { state: 'denied', details: command },
}

export const Expired: Story = {
  args: {
    state: 'expired',
    details: command,
    description: 'The run ended before this was answered.',
  },
}

/** Hostile and oversized values are bounded and rendered as text; the long command scrolls inside its block. */
export const HostileValues: Story = {
  args: {
    title: `<img src=x onerror=alert(1)> ${'Delete everything '.repeat(40)}`,
    description: 'x'.repeat(2000),
    details: {
      kind: 'code',
      language: 'sh',
      title: `bash${RLO}txt.sh`,
      code: `${'echo "<script>alert(1)</script>" && '.repeat(60)}true\n${'sleep 1\n'.repeat(80)}`,
    },
    onApprove: () => undefined,
    onDeny: () => undefined,
  },
}
