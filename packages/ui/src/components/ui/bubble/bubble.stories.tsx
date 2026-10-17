import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { Bubble } from './bubble'

const meta = {
  title: 'UI/Bubble',
  component: Bubble,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The container for what the person sends. The assistant's reply is the page, not a bubble. The state is delivery truth (pending, queued, failed) and always has a word beside it.",
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="flex w-[30rem] max-w-full justify-end">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Bubble>

export default meta
type Story = StoryObj<typeof meta>

export const Sent: Story = { args: { children: 'Summarise the risks in the deployment plan.' } }

export const Pending: Story = {
  args: {
    state: 'pending',
    status: 'Sending…',
    children: 'Summarise the risks in the deployment plan.',
  },
}

/** A follow-up the runtime has not taken yet is dashed: not yet part of the conversation. */
export const Queued: Story = {
  args: {
    state: 'queued',
    status: 'Queued: sent when the agent finishes',
    children: 'Then open a draft PR.',
  },
}

export const Failed: Story = {
  args: {
    state: 'failed',
    status: 'Not sent',
    statusAction: (
      <Button size="2xs" variant="outline">
        Retry
      </Button>
    ),
    children: 'Summarise the risks in the deployment plan.',
  },
}

/** Pasted tokens and long URLs wrap inside the column instead of widening it. */
export const LongUnbrokenText: Story = {
  args: {
    children: `${'x'.repeat(160)}\nhttps://example.com/${'segment/'.repeat(20)}`,
  },
}
