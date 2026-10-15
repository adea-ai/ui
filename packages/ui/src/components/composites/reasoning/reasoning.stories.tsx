import { createSignal, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../../ui/button'
import { Trace } from '../../ui/trace'
import { Reasoning } from './reasoning'

const meta = {
  title: 'Composites/Reasoning',
  component: Reasoning,
  tags: ['autodocs'],
  args: { text: '' },
  parameters: {
    docs: {
      description: {
        component:
          'The agent\'s thinking, as a Trace line, shown only from text the host supplied as user-visible. The title is the state ("Thinking…", "Thought for 4s", "Reasoning"); the body opens while it streams and folds when it is done unless the reader chose otherwise.',
      },
    },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <div class="w-[34rem] max-w-full">
        <Trace aria-label="Activity">
          <Story />
        </Trace>
      </div>
    ),
  ],
} satisfies Meta<typeof Reasoning>

export default meta
type Story = StoryObj<typeof meta>

const summary =
  'The migration touches `users` and the sessions index, so order matters.\n\nI will add the column as nullable first, backfill in batches, and only then add the constraint. Doing it in one statement would hold a lock on `users` for the whole backfill.'

/** Finished with a measured duration: folded, titled by how long it took. */
export const Finished: Story = {
  args: { text: summary, duration: 4 },
}

/** The same thought, held open by the reader. Controlled `open` is the host's to own. */
export const Expanded: Story = {
  args: { text: summary, duration: 4, open: true },
}

/** No duration was measured, so none is claimed. */
export const NoDuration: Story = {
  args: { text: summary },
}

/** Nothing the host marked as visible: a plain line that does not pretend to open. */
export const NoText: Story = {
  args: { text: undefined, duration: 2 },
}

/** Mid-stream and partial: open, shimmering, with a fence that has not closed yet. */
export const Streaming: Story = {
  args: {
    streaming: true,
    text: 'Checking the lock behaviour first.\n\n```sql\nALTER TABLE users ADD COLUMN locale text',
  },
}

/** Streaming has begun but no text has arrived: the line opens and has nothing yet. */
export const StreamingNoTextYet: Story = {
  args: { streaming: true, text: '' },
}

const words = 'Weighing the options for the backfill, batching by primary key range. '

/** Watch the line open as text arrives and fold when the stream ends. Replay to try toggling mid-stream. */
export const LiveStream: Story = {
  render: () => {
    const [text, setText] = createSignal('')
    const [streaming, setStreaming] = createSignal(true)
    const [duration, setDuration] = createSignal<number>()
    let timer: ReturnType<typeof setInterval> | undefined

    const run = () => {
      if (timer) clearInterval(timer)
      setText('')
      setDuration(undefined)
      setStreaming(true)
      let sent = 0
      timer = setInterval(() => {
        sent += 1
        setText(words.repeat(Math.ceil(sent / 3)).slice(0, sent * 24))
        if (sent >= 40) {
          clearInterval(timer)
          setStreaming(false)
          setDuration(sent / 4)
        }
      }, 120)
    }
    run()
    onCleanup(() => timer && clearInterval(timer))

    return (
      <>
        <Reasoning text={text()} streaming={streaming()} duration={duration()} />
        <li class="list-none pt-2">
          <Button size="sm" variant="outline" onClick={run}>
            Replay
          </Button>
        </li>
      </>
    )
  },
}

const long = Array.from(
  { length: 150 },
  (_, index) => `Consideration ${index + 1}: ${'a long line of working. '.repeat(6)}`
).join('\n\n')

/** A very long thought stays inside a capped, scrollable, keyboard-reachable region. */
export const VeryLong: Story = {
  args: { text: long, duration: 61, open: true },
}

/** Untrusted text is text: no HTML, no script links, code stays code. */
export const UntrustedText: Story = {
  args: {
    duration: 1,
    open: true,
    text: '<img src=x onerror=alert(1)> <script>alert(2)</script>\n\n[bad](javascript:alert(3)) and [fine](https://example.com)\n\n```html\n<b>not rendered</b>\n```',
  },
}

/** The host's own wording replaces the derived title. */
export const CustomTitle: Story = {
  args: { text: summary, title: 'Überlegung' },
}
