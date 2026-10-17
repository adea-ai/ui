import { CircleSlash, History, Unplug, TriangleAlert } from 'lucide-solid'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button'
import { Marker } from './marker'

const meta = {
  title: 'UI/Marker',
  component: Marker,
  tags: ['autodocs'],
  args: { label: 'Today' },
  parameters: {
    docs: {
      description: {
        component:
          'A note or divider between turns. The quietest thing in the column: a hairline and a label. A marker is static unless `live` is set, because a divider is not an ARIA separator and most notes are not news.',
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
} satisfies Meta<typeof Marker>

export default meta
type Story = StoryObj<typeof meta>

export const Day: Story = {}

export const Cancelled: Story = {
  args: { label: 'Run cancelled', icon: <CircleSlash />, tone: 'warning' },
}

/** A live marker reports a change the reader must not miss and carries its own action. */
export const Disconnected: Story = {
  args: {
    label: 'Connection lost',
    description: 'Showing the last events received',
    icon: <Unplug />,
    tone: 'danger',
    live: 'assertive',
    action: (
      <Button size="2xs" variant="outline">
        Reconnect
      </Button>
    ),
  },
}

export const Note: Story = {
  args: {
    variant: 'note',
    label: 'Earlier history is not retained',
    icon: <History />,
    description: 'Older events need a checkpoint',
  },
}

export const UnrecognisedEvent: Story = {
  args: {
    variant: 'note',
    label: 'Unrecognised event',
    icon: <TriangleAlert />,
    description: 'session.paused',
  },
}
