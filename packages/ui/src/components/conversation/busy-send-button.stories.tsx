import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { BusySendButton, type BusySendMode } from './busy-send-button'

const meta = {
  title: 'Conversation/Busy send',
  component: BusySendButton,
  args: { mode: 'steer', onModeChange: () => undefined, onFire: () => undefined },
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BusySendButton>
export default meta
type Story = StoryObj<typeof meta>
export const BeforeTyping: Story = {
  render: () => {
    const [mode, setMode] = createSignal<BusySendMode>('steer')
    return <BusySendButton mode={mode()} onModeChange={setMode} onFire={() => undefined} disabled />
  },
}
export const Working: Story = {
  render: () => {
    const [mode, setMode] = createSignal<BusySendMode>('steer')
    const [last, setLast] = createSignal('No action yet')
    return (
      <div class="flex flex-col gap-2">
        <BusySendButton
          mode={mode()}
          onModeChange={setMode}
          onFire={() => setLast(mode())}
          alternateActionHint="Ctrl+Enter uses the other action"
        />
        <output aria-live="polite">{last()}</output>
      </div>
    )
  },
}
/** A missing operation is a visible reason, never a pretend queue. */
export const QueueUnavailable: Story = {
  args: {
    mode: 'queue',
    onModeChange: () => undefined,
    onFire: () => undefined,
    unavailable: { queue: 'This runtime does not support queueing' },
  },
}
export const ReadOnly: Story = {
  args: {
    mode: 'steer',
    onModeChange: () => undefined,
    onFire: () => undefined,
    selectionDisabled: true,
    unavailable: { steer: 'Input authority belongs to another surface' },
  },
}
