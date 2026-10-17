import { createSignal, For, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Bubble } from '../../ui/bubble'
import { Message, MessageContent, MessageText } from '../../ui/message'
import { MessageScroller } from './message-scroller'

const meta = {
  title: 'Composites/Message Scroller',
  component: MessageScroller,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The thread. Follows a streaming reply only while the reader is at the bottom, loads earlier turns without moving what the reader is looking at, and announces settled turns instead of every token.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="flex h-[26rem] w-[40rem] max-w-full flex-col border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageScroller>

export default meta
type Story = StoryObj<typeof meta>

const turn = (index: number) => ({
  id: `turn-${index}`,
  user: `Question ${index}`,
  reply: `Answer ${index}. `.repeat(12),
})

function Turn(props: { value: ReturnType<typeof turn> }) {
  return (
    <>
      <Message role="user" label="You" anchorId={`${props.value.id}-user`}>
        <Bubble>{props.value.user}</Bubble>
      </Message>
      <Message role="assistant" label="Assistant" anchorId={`${props.value.id}-reply`}>
        <MessageContent>
          <MessageText text={props.value.reply} />
        </MessageContent>
      </Message>
    </>
  )
}

/** Scroll to the top: earlier turns arrive and the turn you were reading stays put. */
export const LoadsHistory: Story = {
  render: () => {
    const [oldest, setOldest] = createSignal(31)
    const [loading, setLoading] = createSignal(false)
    const turns = () => Array.from({ length: 40 - oldest() }, (_, i) => turn(oldest() + i))
    return (
      <MessageScroller
        aria-label="Conversation"
        hasOlder={oldest() > 1}
        loadingOlder={loading()}
        onLoadOlder={async () => {
          setLoading(true)
          await new Promise((resolve) => setTimeout(resolve, 400))
          setOldest((value) => Math.max(1, value - 10))
          setLoading(false)
        }}
      >
        <For each={turns()}>{(value) => <Turn value={value} />}</For>
      </MessageScroller>
    )
  },
}

/** A reply that grows: it follows while you are at the bottom, and parks when you scroll up. */
export const StreamingReply: Story = {
  render: () => {
    const [text, setText] = createSignal('Starting. ')
    onMount(() => {
      const timer = setInterval(() => setText((value) => `${value}more streamed text. `), 250)
      setTimeout(() => clearInterval(timer), 20_000)
    })
    return (
      <MessageScroller aria-label="Conversation" announcement="Assistant is responding">
        <For each={Array.from({ length: 12 }, (_, i) => turn(i + 1))}>
          {(value) => <Turn value={value} />}
        </For>
        <Message role="assistant" label="Assistant" streaming>
          <MessageContent>
            <MessageText streaming text={text()} />
          </MessageContent>
        </Message>
      </MessageScroller>
    )
  },
}

export const Empty: Story = {
  args: {
    'aria-label': 'Conversation',
    empty: <p class="text-sm text-muted-foreground">No messages yet.</p>,
  },
}
